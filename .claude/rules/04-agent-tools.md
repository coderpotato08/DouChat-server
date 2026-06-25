# Agent 工具系统规范

> 源码位置：`src/agent/tools/`

## 文件清单

| 文件 | 导出 | 职责 |
|------|------|------|
| `baseTools.ts` | `registerBaseTools(): RegisteredTool[]` | 注册 4 个基础工具 |
| `TodoManager/index.ts` | `TodoManager`, `registerTodoTools(): RegisteredTool[]`, `MAX_TODO_ITEMS`, `PLAN_REMINDER_INTERVAL` | TodoManager + todo 工具注册 |

## 已注册工具（共 5 个）

### baseTools.ts 注册的 4 个工具：

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `safe_path` | `inputPath: string`, `sandboxRoot: string` | 路径解析与校验（必须在 workspace 内） |
| `run_bash` | `command: string`, `cwd?: string`, `timeoutMs?: number` | 执行 bash 命令（受权限策略管控） |
| `run_read` | `filePath: string`, `startLine?: number`, `endLine?: number` | 读取文件内容 |
| `run_write` | `filePath: string`, `content: string`, `append?: boolean` | 写入文件内容 |

### TodoManager/index.ts 注册的 1 个工具：

| 工具名 | 参数 | 功能 |
|--------|------|------|
| `todo` | `items: Array<{content, status, activeForm?}>` | 重写当前会话计划（最多 12 项） |

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
  execute: (args: Record<string, any>) => Promise<any>;  // 工具执行函数
};
```

## 注意事项

- 工具名必须全局唯一（`ToolManager.registerTool` 会检查重复）
- 工具描述必须清晰准确（会直接注入 LLM 的 function calling 定义）
- 工具执行函数必须有错误处理，不应抛出未捕获异常
- 文件操作类工具必须通过 `safe_path` 校验路径
- bash 命令类工具会经过 `checkBashCmdPermission` + `toolPermissionPolicies.run_bash` 双重权限检查
