# ConversationStore 上下文会话管理器核心设计文档

## 文档说明

本文为搭载可插拔上下文压缩能力的会话存储管理器完整架构设计，遵循开闭原则、向下兼容、故障降级三大设计准则，兼容原有LLM会话结构与Mongo存储结构，压缩模块独立解耦可开关。
将原 LLMMessageFormatter、FrontendMessageFormatter 由独立类精简为**纯独立工具函数**，职责单一、无状态、轻量化调用，去除冗余类封装。

## 一、整体架构分层（自上而下）

### 分层结构

1. 外部调用接入层：Agent调度模块、LLM网关服务、后端业务接口、前端聊天接口
2. 统一门面层：ConversationStore 主类（全局唯一对外调用入口）
3. 核心业务内核层
   - 基础会话子模块：全局ID生成、消息合法性校验、兜底上下文截断器
   - 可插拔上下文压缩独立子系统：触发判定器、策略工厂、快照回滚管理器、压缩调度中心
4. 工具函数层（无状态纯函数）
   - formatToLLMMessage：数据库实体 → LLM标准入参结构
   - formatToFrontendMessage：数据库实体 → 前端轮次渲染结构
5. 仓储抽象层：MongoDB仓储封装，隔离底层数据库读写细节
6. 基础设施公共层：全局配置、枚举常量、自定义异常体系

### 核心设计原则

1. 开闭原则：压缩模块完全插件化，关闭自动压缩时自动降级为基础会话读写，无额外性能损耗
2. 向下兼容：存量历史数据无需迁移，压缩扩展字段均为可选非必填字段
3. 降级容错：压缩模块运行异常时，自动切换为传统Token数量截断兜底策略，服务永不中断
4. 链路完整性：压缩全流程保留`sessionId/requestId/messageId/tool_call_id`四组关联键，工具调用溯源、轮次分组、消息绑定永不断裂
5. 轻量化设计：消息格式化逻辑改为纯函数，无实例依赖、可复用、易于单元测试

## 二、基础设施基础组件

### 2.1 IdGenerator 全局有序ID生成器

基于UUIDv7生成时序有序ID，区分业务场景生成不同唯一标识，便于数据库索引排序优化

```typescript
type IdType = "session" | "request" | "message" | "compress_snapshot" | "tool_call";
class IdGenerator {
  static generate(type: IdType): string;
}
```

### 2.2 全局枚举常量定义

```typescript
// 消息角色枚举，对齐OpenAI LLM标准角色
enum MessageRole {
  SYSTEM = "system",
  USER = "user",
  ASSISTANT = "assistant",
  TOOL = "tool",
}

// 上下文压缩策略枚举，支持后续无限扩展新算法
enum CompressStrategy {
  TOKEN_PRUNE = "token_prune", // 轻量级冗余字符裁剪
  ROUND_ABSTRACT = "round_abstract", // 多轮对话合并语义摘要
  SYSTEM_LIGHT = "system_light", // 超长系统提示词轻量化精简
  TOOL_RESULT_MERGE = "tool_merge", // 多轮工具返回结果合并压缩
  LLM_SEMANTIC_SUMMARY = "llm_summary", // 轻量模型深度语义压缩（高阶扩展）
}

// 压缩触发模式枚举
enum CompressTriggerMode {
  MANUAL = "manual",
  AUTO_TOKEN_THRESHOLD = "auto_token",
  IDLE_TIMEOUT = "idle_timeout",
}
```

### 2.3 全局运行时配置 StoreGlobalConfig

支持运行时动态热更新配置，压缩配置独立隔离

```typescript
interface StoreGlobalConfig {
  // 基础会话通用配置
  sortIndexStart: number;
  defaultSessionTTL: number;
  maxRawMessageLength: number;
  fallbackTruncateTokenLimit: number; // 压缩失效兜底Token截断阈值

  // 上下文压缩专属配置
  compress: {
    enableAutoCompress: boolean;
    tokenTriggerThreshold: number;
    reserveLatestRounds: number; // 最新N轮强制保护不压缩，默认3轮
    defaultStrategy: CompressStrategy;
    allowCompressSystemPrompt: boolean;
    allowCompressToolResult: boolean;
    idleCompressDelayMs: number; // 会话闲置静默压缩延迟时长
  };
}
```

### 2.4 统一自定义异常体系

StoreError：基类顶层异常
SessionNotFoundError：会话不存在异常
CompressStrategyNotFoundError：压缩策略未注册异常
MessageRollbackFailedError：压缩回滚失败异常
MessageValidateError：消息格式校验失败异常

## 三、基础会话核心模块

### 3.1 MessageValidator 消息校验器

核心校验规则：
严格校验 role 字段仅允许枚举内合法值
仅 assistant 角色允许 content 为 null（工具调用场景），其余角色禁止空内容
校验 tool_calls、tool_call_id 双向绑定一致性，工具回调 ID 必须一一对应
超长内容前置拦截、特殊脏数据清洗过滤

### 3.2 ContextTruncator 兜底上下文截断器

压缩模块不可用时降级兜底方案：
System 系统提示词永久置顶保留，绝不裁剪
强制保留配置内最新保护轮次对话
从最早历史消息依次裁剪，严格控制整体上下文 Token 上限

### 3.3 MongoConversationRepo 仓储抽象层

封装 MongoDB 全部 CRUD 操作，上层业务无感知底层存储细节，核心方法：

```typescript
class MongoConversationRepo {
  // 单条消息写入
  async insertSingleMessage(entity: ChatMessageEntity): Promise<void>;
  // 压缩后消息字段更新
  async updateCompressedMessage(messageId: string, compressData: Partial<ChatMessageEntity>): Promise<void>;
  // 获取会话全量消息
  async getSessionAllMessages(sessionId: string): Promise<ChatMessageEntity[]>;
  // 获取单轮交互完整消息链
  async getSingleRoundMessages(sessionId: string, requestId: string): Promise<ChatMessageEntity[]>;
  // 创建压缩归档快照
  async createCompressSnapshot(snapshot: CompressSnapshotEntity): Promise<void>;
  // 统计会话总Token消耗
  async calcSessionTotalToken(sessionId: string): Promise<number>;
}
```

## 四、可插拔上下文压缩子系统（独立高内聚模块）

### 4.1 ContextCompressor 压缩总调度入口

串联触发判断、策略分发、原文备份、数据库更新、统计数据上报

```typescript
class ContextCompressor {
  private strategyFactory: CompressStrategyFactory;
  private snapshotManager: CompressSnapshotManager;
  private triggerJudge: CompressTriggerJudge;
  private config: StoreGlobalConfig["compress"];

  // 整会话批量压缩主入口
  async compressSession(sessionId: string, forceStrategy?: CompressStrategy): Promise<CompressResult>;
  // 单条消息独立压缩
  async compressSingleMessage(msg: ChatMessageEntity): Promise<ChatMessageEntity>;
  // 整会话压缩内容回滚原始数据
  async rollbackSession(sessionId: string): Promise<boolean>;
}
```

### 4.2 CompressTriggerJudge 压缩触发判定器

三类触发逻辑，内置保护规则：
自动 Token 阈值触发：会话累计 Token ≥ 配置阈值自动启动压缩
闲置超时触发：会话无新消息达到闲置时长，后台静默压缩历史内容
手动强制触发：业务层主动调用压缩接口
硬性约束：配置保护轮次内消息拒绝任何压缩操作

### 4.3 CompressStrategyFactory 策略工厂（策略模式扩展）

统一抽象接口，新增压缩算法无需修改核心调度代码，符合开闭原则

```typescript
interface ICompressStrategy {
  /** 执行压缩，返回压缩后内容与Token统计 */
  execute(rawMsg: ChatMessageEntity): { newContent: string; tokenStats: CompressTokenStats };
  /** 基于备份原文执行回滚 */
  rollback(compressedMsg: ChatMessageEntity): string | null;
}
```

内置实现类：
TokenPruneStrategy、RoundAbstractStrategy、SystemLightStrategy、ToolMergeStrategy、LlmSemanticSummaryStrategy

### 4.4 CompressSnapshotManager 快照与回滚管理器

压缩前置自动备份原始内容至 originalContent 字段
批量压缩生成全局会话快照归档，留存版本记录
支持单消息回滚、整会话批量回滚、指定快照版本回滚
回滚完成后清空全部压缩标记，完全恢复原始消息结构

## 五、无状态格式化工具函数（替换原有独立 Formatter 类）

### 5.1 formatToLLMMessage

职责
接收单条数据库消息实体，剔除数据库扩展字段、压缩元数据、排序 ID 等冗余字段，严格输出 LLM 接口原生结构；支持压缩内容 / 原始内容切换读取。

```typescript
/**
 * 数据库消息实体转为LLM标准消息结构
 * @param entity 数据库ChatMessageEntity
 * @param useCompressed 是否使用压缩后内容
 * @returns LLM原生message对象
 */
function formatToLLMMessage(entity: ChatMessageEntity, useCompressed: boolean): RawLLMMessage {
  // 内容优先级：开启压缩取压缩content，关闭则读取原始备份
  const finalContent =
    useCompressed && entity.isCompressed ? entity.content : (entity.originalContent ?? entity.content);

  return {
    role: entity.role,
    content: finalContent,
    ...(entity.tool_calls && { tool_calls: entity.tool_calls }),
    ...(entity.tool_call_id && { tool_call_id: entity.tool_call_id }),
  };
}

/**
 * 批量转换整组消息为LLM上下文数组，并按时序排序、System置顶
 */
function batchFormatToLLMContext(entities: ChatMessageEntity[], useCompressed: boolean): RawLLMMessage[] {
  // 按时序排序
  const sorted = [...entities].sort((a, b) => a.sortIndex - b.sortIndex);
  // System消息置顶
  const systemMsgs = sorted.filter((e) => e.role === MessageRole.SYSTEM);
  const chatMsgs = sorted.filter((e) => e.role !== MessageRole.SYSTEM);
  return [...systemMsgs, ...chatMsgs].map((item) => formatToLLMMessage(item, useCompressed));
}
```

### 5.2 formatToFrontendMessage

职责
接收数据库实体，解析嵌套 JSON、挂载压缩 UI 标识、拆分工具类型，输出前端可直接渲染的结构化数据；批量函数支持按 requestId 分组轮次。

```typescript
/**
 * 单条数据库消息转为前端基础渲染消息
 */
function formatToFrontendMessage(entity: ChatMessageEntity): FrontendBaseMsg {
  const displayContent = entity.isCompressed ? entity.content : entity.content;
  return {
    messageId: entity.messageId,
    role: entity.role,
    displayContent,
    rawFullContent: entity.isCompressed ? entity.originalContent : undefined,
    isCompressed: entity.isCompressed,
    compressInfo: entity.compressMeta
      ? { ratio: entity.compressMeta.ratio, algorithm: entity.compressedVersion }
      : undefined,
    isSystemPrompt: entity.role === MessageRole.SYSTEM,
    isLoading: false,
  };
}

/**
 * 按requestId分组，批量组装前端单轮会话结构
 */
function buildFrontendChatRound(
  roundMsgList: ChatMessageEntity[],
  requestId: string,
  sessionId: string,
): FrontendChatRound {
  // 内部完成用户消息、AI工具链、最终回答拆分组装
  // 自动解析tool_calls.arguments字符串为对象，免除前端JSON.parse
  // 绑定toolCallId实现UI关联
  // 封装轮次时间、token元数据
}
```

## 六、核心门面主类 ConversationStore（对外唯一 API）

```typescript
class ConversationStore {
  private repo: MongoConversationRepo;
  private compressor: ContextCompressor;
  private config: StoreGlobalConfig;

  /** 新增单条会话消息，自动补全ID、入库、触发压缩检测 */
  async appendMessage(
    rawPlainMsg: Omit<ChatMessageEntity, "messageId" | "sortIndex" | 压缩扩展字段>,
    sessionId: string,
    requestId: string,
  ): Promise<{ dbEntity: ChatMessageEntity; llmItem: RawLLMMessage; frontendItem: FrontendBaseMsg }>;

  /** 获取LLM可用上下文，支持压缩开关、Token上限截断 */
  async getLLMContext(
    sessionId: string,
    maxToken?: number,
    useCompressed: boolean = true,
  ): Promise<RawLLMMessage[]> {
    const allMsgs = await this.repo.getSessionAllMessages(sessionId);
    let finalMsgs = allMsgs;
    // 兜底截断
    if (maxToken) finalMsgs = ContextTruncator.truncate(finalMsgs, maxToken);
    // 调用纯函数格式化
    return batchFormatToLLMContext(finalMsgs, useCompressed);
  }

  /** 获取前端全会话结构化渲染数据 */
  async getFrontendSessionData(sessionId: string): Promise<FrontendChatRound[]>;

  /** 获取单轮完整交互链路（调试、工具重试场景） */
  async getSingleRoundChat(sessionId: string, requestId: string): Promise<FrontendChatRound>;

  // 压缩专属接口
  async triggerSessionCompress(sessionId: string, strategy?: CompressStrategy): Promise<CompressResult>;
  async rollbackSession(sessionId: string): Promise<boolean>;
  async getSessionCompressStats(sessionId: string): Promise<SessionCompressStats>;

  // 会话生命周期管理
  async clearSession(sessionId: string): Promise<boolean>;
  async createNewSession(): Promise<string>;

  /** 动态更新压缩运行时配置 */
  updateCompressConfig(partialConfig: Partial<StoreGlobalConfig["compress"]>): void;
}
```

## 七、消息全生命周期数据流

### 7.1 新消息写入流程

上层业务调用 appendMessage，传入原始消息、sessionId、requestId
MessageValidator 校验消息合法性，IdGenerator 生成 messageId、自增 sortIndex
组装完整数据库实体，MongoRepo 写入 chat_messages
CompressTriggerJudge 计算会话总 Token，判断是否满足自动压缩条件
满足阈值：备份原文 → 策略压缩 → 更新压缩字段 → 可选生成快照归档
调用格式化纯函数生成 LLM 纯净消息、前端结构化数据，返回调用方

### 7.2 LLM 上下文读取流程

仓储层拉取会话全量消息
超 Token 上限触发 ContextTruncator 兜底裁剪
调用batchFormatToLLMContext纯函数完成排序、字段裁剪、压缩内容切换
输出标准 LLM messageList 数组

### 7.3 压缩回滚恢复流程

调用 rollbackSession 触发回滚
SnapshotManager 读取 originalContent 覆盖压缩后 content
清空 isCompressed、compressMeta、compressedVersion 等压缩标记
数据库更新实体，会话恢复未压缩原始状态

## 八、扩展性预留设计

分布式集群扩展：预留分布式锁适配，防止集群并发重复压缩
缓存层扩展：兼容 Redis 高频上下文缓存，降低 Mongo 查询压力
多模态兼容：预留图片、音频描述文本压缩接口，适配图文混合会话
计费统计扩展：压缩节省 Token 自动统计上报，对接计费模块
权限管控扩展：会话读写、压缩、回滚精细化权限隔离
格式化函数扩展：新增输出格式仅需新增独立纯函数，无需改动核心业务类

## 九、/ai/session/get 接口响应数据结构（前端历史会话渲染）

> 状态：📋 待实现（代办）

### 9.1 设计目标

支撑前端两个场景的「todo 代办状态 + 工具调用链」渲染：

1. **首次进入获取历史会话**：一次性还原会话全貌——最新 todo 计划状态 + 每轮的工具调用链 + 最终答复。
2. **每轮 AI 答复（实时）**：SSE 的 `tool_use_start` / `tool_use_done` 事件 `data` / `success` 与本结构中 `toolCalls[].args` / `result` / `success`、`todo` 字段同构，前端历史与实时复用同一套渲染组件。

### 9.2 响应结构

按轮（round）组织，每轮带 `toolCalls`（工具调用链）与 `todo`（该轮结束时的计划快照）；顶层 `currentTodo` 为最新计划状态，供首次进入直接还原 todo 面板。

```json
{
  "session": {
    "sessionId": "01J...",
    "title": "生成短文并写入文件",
    "status": "active",
    "modelProvider": "DOUBAO",
    "messageCount": 6,
    "lastMessagePreview": "已生成短文并写入 data/temp.txt",
    "createdAt": "2026-07-10T10:00:00Z",
    "updatedAt": "2026-07-10T10:05:00Z"
  },
  "currentTodo": {
    "items": [
      { "content": "生成200字短文", "status": "completed", "activeForm": "writing" },
      { "content": "将短文写入 data/temp.txt", "status": "completed", "activeForm": "writing file" }
    ]
  },
  "rounds": [
    {
      "requestId": "req_001",
      "prompt": "帮我生成一篇200字短文并写入 data/temp.txt",
      "answer": "已为你生成短文并写入 data/temp.txt。",
      "toolCalls": [
        {
          "toolCallId": "call_a",
          "toolName": "todo",
          "args": {
            "items": [
              { "content": "生成200字短文", "status": "in_progress", "activeForm": "writing" },
              { "content": "将短文写入 data/temp.txt", "status": "pending", "activeForm": "" }
            ]
          },
          "result": {
            "items": [
              { "content": "生成200字短文", "status": "in_progress", "activeForm": "writing" },
              { "content": "将短文写入 data/temp.txt", "status": "pending", "activeForm": "" }
            ]
          },
          "success": true
        },
        {
          "toolCallId": "call_b",
          "toolName": "run_write",
          "args": { "filePath": "data/temp.txt", "content": "我想吃大便..." },
          "result": { "ok": true, "path": "data/temp.txt" },
          "success": true
        }
      ],
      "todo": {
        "items": [
          { "content": "生成200字短文", "status": "in_progress", "activeForm": "writing" },
          { "content": "将短文写入 data/temp.txt", "status": "pending", "activeForm": "" }
        ]
      },
      "createdAt": "2026-07-10T10:00:00Z",
      "updatedAt": "2026-07-10T10:02:00Z"
    },
    {
      "requestId": "req_002",
      "prompt": "把文件读出来给我看看",
      "answer": "文件内容是：我想吃大便...",
      "toolCalls": [
        {
          "toolCallId": "call_c",
          "toolName": "run_read",
          "args": { "filePath": "data/temp.txt" },
          "result": { "content": "我想吃大便..." },
          "success": true
        }
      ],
      "todo": null,
      "createdAt": "2026-07-10T10:03:00Z",
      "updatedAt": "2026-07-10T10:04:00Z"
    }
  ]
}
```

### 9.3 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `session` | object | 会话元信息（同现有 `/ai/session/get` 的 session 字段） |
| `currentTodo` | `{ items: TodoItem[] } \| null` | 最新计划状态，取最后一个含 todo 工具调用的轮次的 `todo`；无则 null |
| `rounds[]` | array | 按 `requestId` 分组的轮次数组，按时间升序 |
| `rounds[].requestId` | string | 单轮请求 ID |
| `rounds[].prompt` | string | 本轮用户输入 |
| `rounds[].answer` | string | 本轮 AI 最终答复文本 |
| `rounds[].toolCalls[]` | array | 本轮工具调用链，按时序排列 |
| `toolCalls[].toolCallId` | string | 工具调用 ID（关联 assistant.tool_calls.id 与 tool.tool_call_id） |
| `toolCalls[].toolName` | string | 工具名 |
| `toolCalls[].args` | object | 工具入参对象（反序列化后的 parsedArgs，非字符串） |
| `toolCalls[].result` | object | 工具输出对象（反序列化后的 output，非字符串） |
| `toolCalls[].success` | boolean | 是否执行成功 |
| `rounds[].todo` | `{ items: TodoItem[] } \| null` | 本轮结束时的计划快照；本轮无 todo 工具调用则为 null（前端可向前继承） |
| `TodoItem` | `{ content, status, activeForm }` | status: pending / in_progress / completed |

### 9.4 与现有结构的映射

- `rounds` 由 `getFrontendSessionData`（见 5.2 `buildFrontendChatRound`）产出，按 `requestId` 分组。
- `toolCalls[].args` 来源：assistant 消息的 `tool_calls[].function.arguments`（JSON 反序列化）。
- `toolCalls[].result` 来源：对应 `tool` 角色消息的 `content`（JSON 反序列化）；失败时为 `{ error: message }`，`success: false`。
- `todo` / `currentTodo`：从 `toolName === "todo"` 的工具调用 `result.items` 提取。
- `system` 消息不进入 `rounds`（仅用于 LLM 上下文，不展示）。

### 9.5 待办

- [ ] 在 `getSession` controller 中将 `messages` 平铺结构改为 `rounds` 分组 + `currentTodo` 聚合
- [ ] 复用 `buildFrontendChatRound` 完成 assistant.tool_calls ↔ tool 结果的绑定与反序列化
- [ ] 前端 `SessionMessageItem` / `GetSessionResult` 类型同步为 rounds 结构
- [ ] 与 SSE 实时事件（`tool_use_start/done`）的 data/success 形状对齐校验
