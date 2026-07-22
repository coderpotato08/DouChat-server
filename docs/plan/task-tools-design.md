# Task 任务系统相关工具

## 需求描述

构建一个会话级、磁盘持久化的 Task 系统，记录每个任务的工作内容、状态和依赖关系，并通过工具提供给大模型。

## 已实现工具

- `task_create`：创建任务。参数为 `subject`、`description` 和可选 `blockedBy`；返回 `{ taskId, subject }`。
- `task_get`：按 `taskId` 获取当前会话内的单个任务。
- `task_list`：列出当前会话的任务，可按可选 `status` 过滤；按 `createdAt` 升序、ID 兜底排序。
- `task_update`：更新 `subject`、`description`、`status` 或 `blockedBy`；返回更新后的完整 Task。

`task_stop` 已移除：暂停/状态变更统一由 `task_update` 的 `status` 参数处理，避免职责重叠。

## Task 数据模型

每个 Task 包含：

- `id`：`task_<uuidv7>` 格式，由 `IdGenerator.generate("task")` 生成。
- `subject`、`description`：任务标题和工作说明。
- `status`：`pending`、`in_progress` 或 `completed`。
- `blocks`：自动维护的反向依赖，表示依赖当前任务的任务 ID 列表。
- `blockedBy`：当前任务的前置任务 ID 列表。
- `createdAt`、`updatedAt`：ISO 8601 时间戳。
- `owner`：为未来子 Agent 所有权预留，本次不提供写入入口。

## 持久化与会话隔离

任务以 sessionId 分目录、每个任务单独 JSON 文件持久化：

```
data/.douchat/task/{sessionId}/
├─ task_<uuidv7>.json
├─ task_<uuidv7>.json
└─ task_<uuidv7>.json
```

路径只由内部 `TaskStore` 构造，并校验 sessionId/taskId 为安全路径段，避免目录穿越。单文件写入采用临时文件加 rename；涉及多个任务的依赖更新会先完成内存校验并批量写入，失败时尽力回滚。任务锁与跨请求竞争控制仍属于未来扩展。

## 依赖与状态规则

1. `blockedBy` 中的任务必须存在于同一 session，禁止重复依赖和自依赖。
2. 系统自动同步 `blockedBy` 和相关前置任务的 `blocks`，模型不能直接修改 `blocks`。
3. 禁止直接或间接依赖环。
4. 只有所有 `blockedBy` 任务均为 `completed` 时，任务才可更新为 `in_progress` 或 `completed`。
5. 若某 completed 任务被 in_progress/completed 的下游任务依赖，禁止将该前置任务回退为未完成状态，保持全局依赖一致性。
6. `task_update.blockedBy` 为完整替换语义，传入 `[]` 会清空全部前置依赖。
7. 磁盘 JSON 无法解析、不符合 Task Schema 或存在不一致依赖时，读取严格失败，避免大模型在不完整状态上继续执行。

## 主流程接入

Task 工具通过 `registerTaskTools()` 注册到 `MainAgent`，替代原先的 `todo` 工具注册。`ToolManager` 会把请求级 `AgentContext` 显式传给工具，因此 TaskStore 使用 `context.sessionId` 隔离数据；模型无需也不能传入 sessionId。

TodoManager 源码暂时保留，但已不在主流程注册。

## 预留扩展（未来可实现）

1. 任务竞争锁：创建任务后分配任务锁，执行竞争时按锁顺序交接。
2. 子 Agent owner：后续为任务分配所有者，只有持有该 owner 的 Agent 可执行和维护任务。
