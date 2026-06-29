# ConversationStore 数据库设计文档

## 一、设计概述

1. 存储载体：MongoDB，双集合隔离业务消息与压缩快照
2. 约束要求：单条Mongo文档对应一条LLM原始message，强制携带`sessionId/requestId/messageId`三标识
3. 兼容性：压缩字段为可选扩展字段，旧数据无此字段自动兼容，不破坏存量数据
4. 索引优化：围绕会话查询、轮次分组、压缩筛选做复合索引，保障读写性能

## 二、主集合：ai_chat_messages（核心消息集合）

### 基础固定字段（需求强制必填）

| 字段名       | 类型           | 约束                             | 业务说明                                                         |
| ------------ | -------------- | -------------------------------- | ---------------------------------------------------------------- |
| \_id         | ObjectId       | 主键默认                         | MongoDB内置主键兜底                                              |
| messageId    | String         | 唯一索引、非空                   | 单条消息全局唯一ID，UUIDv7生成                                   |
| sessionId    | String         | 联合索引、非空                   | 整场聊天会话唯一标识，一个聊天窗口绑定一个sessionId              |
| requestId    | String         | 联合索引、非空                   | 单轮交互ID：用户提问→AI思考→工具调用→AI最终回复共用同一requestId |
| role         | String         | 枚举：system/user/assistant/tool | LLM标准角色，严格限定取值                                        |
| content      | String \| null | 允许null                         | 原始对话内容，assistant发起工具调用时content固定为null           |
| tool_calls   | Array<Object>  | 可选                             | 仅assistant角色存在，存储函数调用结构体                          |
| tool_call_id | String         | 可选                             | 仅tool角色存在，绑定对应assistant工具调用id                      |
| sortIndex    | Number         | 非空自增                         | 同session内消息时序排序字段，保证上下文拼接顺序稳定              |
| createdAt    | Date           | 默认当前时间、非空               | 消息入库时间戳                                                   |
| meta         | Object         | 可选扩展                         | 模型版本、token消耗、路由标签、Agent路由目标等自定义元数据       |

### 上下文压缩扩展字段（可选，仅压缩消息赋值）

| 扩展字段          | 类型           | 默认值 | 说明                                                                    |
| ----------------- | -------------- | ------ | ----------------------------------------------------------------------- |
| isCompressed      | Boolean        | false  | 标记本条消息是否经过上下文压缩处理                                      |
| originalContent   | String \| null | null   | 压缩前原始文本，用于回滚恢复原文                                        |
| compressedVersion | String \| null | null   | 压缩策略标记：token_prune / round_abstract / system_light / llm_summary |
| compressMeta      | Object \| null | null   | 压缩统计：原始token、压缩后token、压缩比例、触发阈值                    |
| mergedRoundIds    | String[]       | []     | 多轮合并压缩时，记录被合并的requestId数组，用于溯源分组                 |

### 单条完整示例文档

```json
{
  "_id": ObjectId("64f8d210abc1234567890001"),
  "messageId": "msg-7f2a9d01-88cc-44dd-aaee-112233445566",
  "sessionId": "sess-chat-001-user008",
  "requestId": "req-round-package-query-003",
  "role": "assistant",
  "content": null,
  "tool_calls": [
    {
      "id": "call_read_package_json_001",
      "type": "function",
      "function": {
        "name": "run_read",
        "arguments": "{\"filePath\":\"/xxx/package.json\",\"startLine\":1,\"endLine\":120}"
      }
    }
  ],
  "tool_call_id": null,
  "sortIndex": 8,
  "createdAt": ISODate("2026-06-28T10:20:00Z"),
  "meta": {
    "model": "gpt-4o-mini",
    "routeTarget": "agent_loop",
    "inputToken": 120
  },
  "isCompressed": false,
  "originalContent": null,
  "compressedVersion": null,
  "compressMeta": null,
  "mergedRoundIds": []
}
```

## 三、ai_chat_compress_snapshots 压缩快照集合设计

### 集合用途

用于整会话批量压缩、版本快照、批量回滚，避免单条消息冗余存储合并上下文，统一归档会话压缩历史，支持多版本回溯恢复。

### 字段结构定义

| 字段名                | 类型     | 说明                                             |
| --------------------- | -------- | ------------------------------------------------ |
| snapshotId            | String   | 快照全局唯一ID，UUIDv7生成                       |
| sessionId             | String   | 归属会话ID，关联主集合ai_chat_messages           |
| triggerMode           | String   | 触发类型枚举：manual / auto_token / idle_timeout |
| strategy              | String   | 本次压缩使用的算法策略，与压缩策略枚举对齐       |
| coveredRequestIds     | String[] | 本次压缩覆盖的全部轮次requestId列表              |
| fullCompressedContext | String   | 整会话合并精简后的完整上下文文本                 |
| createTime            | Date     | 快照生成时间                                     |
| canRollback           | Boolean  | 是否支持回滚原始完整会话数据                     |
| totalSaveToken        | Number   | 本次压缩整体节省Token总量                        |

### 单条完整示例文档

```json
{
  "_id": ObjectId("64f8d320abc1234567890002"),
  "snapshotId": "snap-9e3b2c10-11aa-22bb-33cc-998877665544",
  "sessionId": "sess-chat-001-user008",
  "triggerMode": "auto_token",
  "strategy": "round_abstract",
  "coveredRequestIds": [
    "req-round-package-query-003",
    "req-round-agent-reg-check-004"
  ],
  "fullCompressedContext": "历史对话精简：用户先后要求读取package.json获取项目启动脚本、查询Agent工具注册位置，AI调用文件读取工具完成查询并给出结论。",
  "createTime": ISODate("2026-06-28T10:35:00Z"),
  "canRollback": true,
  "totalSaveToken": 680
}
```

## 四、MongoDB 全集合索引配置文档

### 索引设计说明

1. 复合索引sessionId+requestId+sortIndex覆盖 90% 会话读取场景，保证对话顺序稳定；
2. 唯一索引保障 messageId 全局不重复，避免重复消息污染上下文；
3. TTL 索引自动清理长期闲置会话，降低存储成本；
4. 压缩专用索引提升历史精简消息筛选效率。

### ai_chat_messages 主集合索引

```javascript
// 1. 高频核心查询：会话+轮次+时序排序（最高优先级，聊天上下文拼接必用）
db.ai_chat_messages.createIndex({ sessionId: 1, requestId: 1, sortIndex: 1 });

// 2. 压缩消息快速筛选索引，批量查询已压缩历史对话
db.ai_chat_messages.createIndex({ sessionId: 1, isCompressed: 1 });

// 3. 消息全局唯一约束，防止重复写入同一条消息
db.ai_chat_messages.createIndex({ messageId: 1 }, { unique: true });

// 4. 过期会话自动TTL清理（30天过期自动删除冷会话数据）
db.ai_chat_messages.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
```

### ai_chat_compress_snapshots 快照集合索引

```javascript
// 按会话+时间倒序，快速取最新压缩快照
db.ai_chat_compress_snapshots.createIndex({ sessionId: 1, createTime: -1 });
```

## 五、ConversationStore 数据库全局数据约束规则

### 1. requestId 轮次绑定规则

用户发起全新提问时生成新`requestId`；本轮交互内 assistant、tool 角色消息必须复用当前`requestId`，仅当下一次用户发送新提问时才更换轮次ID，保证一轮问答链路归属统一。

### 2. system 系统消息归属约束

system提示消息仅绑定`sessionId`，不属于任何`requestId`；LLM上下文拼接时永久置顶，独立于问答轮次，压缩时可单独配置精简开关。

### 3. 压缩保护硬性规则

配置中设定的最新N轮对话（默认3轮）强制禁止压缩，仅对更早历史对话执行压缩，保障当前正在交互的对话语义完整性与连贯性。

### 4. 工具调用链路不可破坏约束

压缩逻辑禁止修改、清空`tool_call_id`、`tool_calls.id`，无论单条精简还是多轮合并压缩，必须保留工具调用与工具返回结果的关联键，保证溯源、重试、UI配对展示可用。

### 5. 空内容合法性约束

仅`assistant`角色允许`content: null`（发起工具调用场景），user、system、tool角色不允许content为null，入库前校验拦截非法数据。

### 6. 压缩回滚数据完整性约束

标记为`isCompressed: true`的消息必须存在合法`originalContent`原始备份，无原始内容则禁止执行压缩，回滚时必须用原文覆盖压缩内容并清空压缩标记。
