# Agent 工具系统规范

> 源码位置：`src/agent/tools/`

## 文件清单

| 文件 | 导出 | 职责 |
|------|------|------|
| `baseTools.ts` | `registerBaseTools(): RegisteredTool[]` | 注册 4 个基础工具 |
| `TaskTool/index.ts` | `registerTaskTools(): RegisteredTool[]` | 注册会话级持久化 Task 工具 |
| `TaskTool/task-manager.ts` | `TaskManager` | Task CRUD、依赖同步和状态约束 |
| `TaskTool/task-store.ts` | `TaskStore` | `data/.douchat/task/{sessionId}` 磁盘持久化 |
| `TodoManagerTool/index.ts` | `TodoManager`, `registerTodoTools(): RegisteredTool[]` | Todo 源码保留，当前不注册 |

## 已注册工具（共 8 个）

### baseTools.ts 注册的 4 个工具：

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `safe_path` | `inputPath: string`, `sandboxRoot: string` | 路径解析与校验（必须在 workspace 内） |
| `run_bash` | `command: string`, `cwd?: string`, `timeoutMs?: number` | 执行 bash 命令（受权限策略管控） |
| `run_read` | `filePath: string`, `startLine?: number`, `endLine?: number` | 读取文件内容 |
| `run_write` | `filePath: string`, `content: string`, `append?: boolean` | 写入文件内容 |

### TaskTool/index.ts 注册的 4 个工具：

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `task_create` | `subject`, `description`, `blockedBy?` | 创建当前会话的持久化任务，自动维护反向依赖 |
| `task_get` | `taskId` | 读取当前会话内的单个任务 |
| `task_list` | `status?` | 按创建时间列出当前会话任务，可过滤状态 |
| `task_update` | `taskId`, `subject?`, `description?`, `status?`, `blockedBy?` | 更新任务；blockedBy 是整表替换，并校验依赖/状态规则 |

TodoManager 源码仍在 `TodoManagerTool/index.ts`，但主流程不再注册 `todo`。

## 工具注册流程

1. 创建工具文件（如 `src/agent/tools/my-tool.ts`）
2. 导出 `registerXxxTools(): RegisteredTool[]` 函数
3. 每个工具实现 `RegisteredTool` 接口：`{ name, description, parameters, execute }`
4. 在 `MainAgent` 构造函数中调用 `this.toolManager.registerTools([...registerXxxTools()])`
5. 如果工具需要权限控制，在 `src/agent/permission/index.ts` 的 `toolPermissionPolicies` 中添加策略

## RegisteredTool 接口

```ts
type RegisteredToolConfig = {
  name: string;                                  // 工具名（全局唯一）
  description: string;                           // 工具描述（会注入 LLM prompt）
  parameters: Record<string, z.ZodType>;         // Zod 参数定义
};

type RegisteredTool = RegisteredToolConfig & {
  execute: (args: Record<string, any>, context: AgentContext) => Promise<any>;  // 工具执行函数
};
```

## 注意事项

- 工具名必须全局唯一（`ToolManager.registerTool` 会检查重复）
- 工具描述必须清晰准确（会直接注入 LLM 的 function calling 定义）
- 工具执行函数必须有错误处理，不应抛出未捕获异常
- 工具参数会在 `ToolManager.executeToolHandler()` 中由 Zod 运行时校验，工具可直接使用已校验的参数
- Task 工具以 `context.sessionId` 隔离数据；路径只由内部 TaskStore 构造，因此无需新增权限策略
- Task 的 `blockedBy`/`blocks` 由 TaskManager 自动同步；不得绕过 TaskManager 直接写任务 JSON
- 文件操作类工具必须通过 `safe_path` 校验路径
- bash 命令类工具会经过 `checkBashCmdPermission` + `toolPermissionPolicies.run_bash` 双重权限检查
