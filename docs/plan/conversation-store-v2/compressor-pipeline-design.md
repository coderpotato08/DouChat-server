# 上下文压缩管线架构设计（ConversationStore v2 - Compressor Pipeline）

> 状态：📋 待实现（代办）
> 关联：[[conversation-store-design]] 第四章（可插拔压缩子系统）、第九章（/ai/session/get 响应结构）

## 一、设计目标

实现「三阶段依次降级」的上下文压缩，控制长会话上下文体积，保障 Agent loop 稳定与成本：

```
每轮自动（L3->L1->L2 管线）  ->  条件触发（autoCompact）  ->  异常触发（熔断）
```

- **每轮自动**：每轮对话后跑三层管线，轻量、可逆、无 LLM 介入。
- **条件触发**：管线跑完上下文仍过大，用 LLM 把旧对话压成摘要，完整对话落 `.transcript/`。
- **异常触发**：连续失败 3 次强制终止，防循环烧资源。

## 二、三阶段设计

### 2.1 每轮自动（Pipeline：L3 -> L1 -> L2）

每轮 `appendMessage` 后执行，三层顺序管线，各层内部按阈值决定是否动作。

#### L3 - ToolResultBudget 大结果落盘（跨消息 + 磁盘）
- 触发：工具调用结果总量 > 阈值。
- 动作：从占用上下文最大的结果开始，`content` 替换为占位符（如 `<persisted-result>`），**实际结果落盘到磁盘目录**。
- 回滚：从磁盘文件读取还原；`compressMeta` 记录文件路径。

#### L1 - snipCompact 对话裁剪（会话级）
- 触发：对话轮数 > 阈值（如 50 条）。
- 动作：截取中间，保留**头部 3 条**（初始目标）+ **尾部 n-3 条**（当前任务）。
- 约束：**不得把 assistant 与其后紧跟的 user / tool_result 拆开**（按 `requestId` / `tool_call_id` 分组边界裁剪）。
- 可逆：被裁剪的中间段落落入 `.transcript/` JSONL 留档（可追回）。

#### L2 - microCompact 旧工具结果占位（跨消息）
- 触发：历史工具结果条数超过保留数。
- 动作：只保留最近 N 条工具调用记录，更早的 tool 结果 `content` 替换为占位符。
- 与 L3 区别：**结果不落盘**，原文保留在 DB `originalContent` 字段（回滚从 DB 取）。

### 2.2 条件触发 - autoCompact（LLM 摘要）
- 触发：L3-L1-L2 管线跑完后，上下文仍超阈值。
- 动作：
  - 旧对话记录通过 **LLM 压缩成摘要**，摘要替换原消息内容。
  - **完整对话落入 `.transcript/` 中的 JSONL 文件**，方便历史追回。
- 生成快照归档到 `ai_chat_compress_snapshots`（复用现有快照集合）。

### 2.3 异常触发 - 熔断器（CircuitBreaker）
- 按 session 计连续失败次数。
- 连续失败 ≥ 3 次：强制跳过该 session 后续压缩，防止循环导致资源浪费。
- 成功一次即清零计数。

## 三、现有架构差距分析

现有 compressor 模块**全部为空桩**（`ContextCompressor` / `CompressTriggerJudge` / `CompressStrategyFactory` 内置策略 / `CompressSnapshotManager` 核心方法均 `throw not implemented`，`shouldCompress` 恒返回 false）。四个根本不匹配：

1. **策略粒度**：现 `ICompressStrategy.execute(rawMsg: 单条消息)` 是单消息级；L1 是会话级、L2/L3 是跨消息协调，单消息接口装不下。
2. **调度模型**：现 `compressSession` 是「选一个策略跑一次」；目标是 L3->L1->L2 顺序管线。
3. **触发模型**：现 `CompressTriggerJudge.shouldCompress` 是单一布尔门；目标要区分每轮自动 / 条件触发 / 熔断。
4. **磁盘能力**：现架构无磁盘持久化（原文只在 Mongo `originalContent`）；L3 工具结果落盘 + autoCompact `.transcript/` JSONL 是新能力。

## 四、现有模块去留

### 保留
| 模块 | 保留原因 | 备注 |
|------|----------|------|
| `CompressStrategyFactory`（register/get 模式） | 工厂模式可用 | 注册的策略类换成新的 4 个 |
| `CompressSnapshotManager` | 快照/回滚骨架在 | 补磁盘落盘能力 |
| 存储字段 `isCompressed`/`originalContent`/`compressedVersion`/`compressMeta`/`mergedRoundIds` | L2/L3 占位+回滚复用 | L3 落盘需区分「原文在DB」vs「原文在磁盘」 |
| `ai_chat_compress_snapshots` 快照集合 | autoCompact 快照复用 | - |
| `ConversationStore.appendMessage` 接入点 | 每轮自动挂这里 | 触发逻辑改 |
| `StoreGlobalConfig.compress` 配置结构 | 扩展即可 | 加新阈值 |
| `ContextTruncator`（兜底截断） | 思路与 L1 相近 | 作最终兜底或并入 L1 |

### 改 / 新增
| 项 | 说明 |
|----|------|
| 策略接口 | 新增会话级 `IPipelineStage.execute(sessionId, messages) -> { messages, stats }`；单消息接口保留给未来 |
| 管线编排器 | 新增 `CompressionPipeline`（或 `ContextCompressor` 内）串联 L3->L1->L2 |
| 触发判定 | 不单独成模块，`shouldRunPipeline`（每轮）+ `shouldAutoCompact`（条件）内聚为 `ContextCompressor` 私有方法；熔断由 `CircuitBreaker` 承担 |
| 磁盘落盘模块 | 新增 `DiskPersistenceStore`：工具结果文件读写 + transcript JSONL |
| 熔断器 | 新增 `CircuitBreaker`：按 session 计失败，≥3 跳过 |
| 策略枚举/类 | `token_prune/round_abstract/system_light/tool_merge/llm_summary` -> `snip_compact/micro_compact/tool_result_budget/auto_compact` |
| 配置扩展 | L1 轮数阈值(50)/保留头尾(3, n-3)、L2 保留最近工具条数、L3 结果总量阈值、transcript 目录、熔断阈值(3) |
| 消息模型 | L2 原文存 `originalContent`（DB）；L3 原文写磁盘、`compressMeta` 存路径、`content` 改 `<persisted-result>` |

## 五、目标结构（目录树，kebab-case）

保留模块文件名已与现有对齐（`context-compressor` / `snapshot-manager` / `strategy-factory`），无需重命名；新增模块按 `-` 模式拼接。

```
src/agent/memory/compressor/
├─ context-compressor.ts           # ContextCompressor 总调度（保留）
├─ pipeline/                       # 每轮自动管线（新增目录）
│   ├─ compression-pipeline.ts     #   CompressionPipeline 编排器
│   ├─ tool-result-budget-stage.ts #   L3 ToolResultBudgetStage
│   ├─ snip-compact-stage.ts       #   L1 SnipCompactStage
│   └─ micro-compact-stage.ts      #   L2 MicroCompactStage
├─ auto-compact-strategy.ts        # AutoCompactStrategy 条件触发（新增）
├─ circuit-breaker.ts              # CircuitBreaker 熔断（新增）
├─ disk-persistence-store.ts       # DiskPersistenceStore 磁盘落盘（新增）
├─ snapshot-manager.ts             # CompressSnapshotManager（保留）
└─ strategy-factory.ts             # CompressStrategyFactory + ICompressStrategy（保留）
```

> 已移除：`strategy-factory.ts` 内 5 个空桩策略类（TokenPruneStrategy / RoundAbstractStrategy / SystemLightStrategy / ToolMergeStrategy / LlmSemanticSummaryStrategy）及 `NOT_IMPLEMENTED` 辅助；`ICompressStrategy` 单消息接口按文档「保留给未来」予以保留。`trigger-judge.ts`（`CompressTriggerJudge`）已移除，触发判定并入 `ContextCompressor`。

## 六、落地阶段（最小可用闭环）

> 注：以下为实现顺序（由简到难、最小闭环优先），与管线执行顺序 L3->L1->L2 相互独立——执行顺序在 `compression-pipeline.ts` 编排器中配置，各 stage 可按任意顺序实现后接入。

1. **L1 snipCompact** + 管线编排器骨架 + 每轮触发 -> 先让「每轮自动」跑起来。
2. **L2 microCompact**（占位，原文留 DB）-> 复用现有 `originalContent`，无磁盘。
3. **熔断器** -> 任何阶段失败保护。
4. **L3 ToolResultBudget** + `DiskPersistenceStore` -> 引入磁盘。
5. **autoCompact** + transcript JSONL -> 条件触发的 LLM 摘要。

## 七、待办

- [ ] 新增 `IPipelineStage` 会话级接口，替换单消息 `ICompressStrategy` 为主抽象
- [ ] 新增 `pipeline/` 目录 + `compression-pipeline.ts` 编排器（L3->L1->L2 顺序执行）
- [ ] 实现 L1 `snip-compact-stage.ts`（轮数阈值 + 头3尾n-3 + requestId 边界不拆对 + 裁剪段落入 transcript）
- [ ] 实现 L2 `micro-compact-stage.ts`（旧 tool 结果占位，原文留 `originalContent`）
- [ ] 实现 L3 `tool-result-budget-stage.ts`（大结果占位 + 磁盘落盘 + `compressMeta` 存路径）
- [ ] 新增 `disk-persistence-store.ts`（工具结果文件 + `.transcript/` JSONL 读写）
- [ ] 新增 `auto-compact-strategy.ts`（LLM 摘要 + 完整对话落 transcript + 快照归档）
- [x] 触发判定并入 `ContextCompressor`（`shouldRunPipeline` / `shouldAutoCompact` 私有方法），移除 `trigger-judge.ts`
- [ ] 新增 `circuit-breaker.ts`（按 session 计失败，≥3 熔断，成功清零）
- [ ] 策略枚举/类替换为 `snip_compact/micro_compact/tool_result_budget/auto_compact`
- [x] `StoreGlobalConfig.compress` 扩展阈值（pipeline.l1: roundThreshold/keepHead/keepTail、l2: keepRecentToolResults、l3: toolResultBudgetTokens、circuitBreakerFailureThreshold、diskRootDir）
- [ ] 消息模型确认 L3 落盘字段方案（`compressMeta` 路径 + 占位符 content）
- [ ] `ConversationStore.appendMessage` 接入新管线 + 熔断
