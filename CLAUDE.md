# CLAUDE.md — AI 编码行为指南

> 本文档是项目级 AI 编码约束。模块级规范见 `.claude/rules/` 目录。

---

## 核心规则

### 1. 改代码前先读相关文档

**操作流程**：
1. 理解用户需求
2. 读 `DESIGN.md` 确认改动不破坏现有架构
3. 查看目标文件及其依赖
4. 实现变更
5. 如果新增模块，更新 `DESIGN.md`

### 2. 不要重复造轮子

在创建新函数/类之前，先搜索项目中是否已有类似实现：

| 场景 | 必须使用 |
|------|---------|
| LLM 调用 | `src/agent/engine/llm-service.ts` → `LlmService.getClientBundle()` |
| 请求校验 | `src/middleware/validate-request.ts` → `validateRequest()` |
| API 响应 | `src/models/responseModel.ts` → `createRes()` |
| Agent 初始化 | `src/agent/engine/main-agent.ts` → `initMainAgent()` / `getMainAgent()` |
| 工具注册 | `src/agent/engine/tool-manager.ts` → `ToolManager.registerTools()` |
| Hook 注册 | `src/agent/engine/hook-manager.ts` → `HookManager.registerHooks()` |
| 权限检查 | `src/agent/permission/index.ts` → `checkCommandPermissionRules()` |
| 工具类型 | `src/agent/types/tools.ts` → `ToolExecutionResponse` |
| Agent 类型 | `src/agent/types/agent.ts` → 所有 Agent 相关类型 |
| 会话存储 | `src/agent/memory/conversation-store.ts` → `ConversationStore` |
| SSE 流 | `src/utils/sse-utils.ts` → `createSSESession()` |

### 3. 不要破坏现有模块

- 修改一个模块的导出时，检查所有引用方
- 不要在 controller 中直接操作数据库
- 不要在 controller 中直接访问 Agent 内部状态
- 不要绕过 `ToolManager` 直接调用工具
- 不要绕过 `LlmService` 直接 `new OpenAI()`

---

## 编码规范

### 命名

| 类型 | 风格 | 示例 |
|------|------|------|
| 文件 | kebab-case | `chat-room.ts`, `main-agent.ts` |
| 类 | PascalCase | `MainAgent`, `ToolManager` |
| 函数/变量 | camelCase | `buildContext`, `userMessage` |
| 常量 | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| 接口/类型 | PascalCase | `AgentContext`, `ToolResult` |

### TypeScript

- 所有函数/方法必须有类型注解
- 禁止使用 `any`（除非有注释说明理由）
- Agent 相关类型放 `src/agent/types/agent.ts`
- 工具相关类型放 `src/agent/types/tools.ts`

### 文件组织

- 每个文件只导出一个核心类/函数
- 相关的辅助函数放在同一文件
- 不要创建超过 300 行的单文件（除非有充分理由）

---

## 禁止事项

- ❌ 在 controller 中直接操作数据库
- ❌ 绕过 `LlmService.getClientBundle()` 直接 `new OpenAI()`（若用户明确指定指定子agent用自己的OpenAi实例的情况可以允许直接`new OpenAI()`）
- ❌ 在 controller 中访问 Agent 内部状态（`MainAgent` 私有字段）
- ❌ 新增工具但不通过 `ToolManager.registerTools()` 注册
- ❌ 新增权限规则但不更新 `src/agent/permission/index.ts` 中的 `toolPermissionPolicies`
- ❌ 删除或修改 `DESIGN.md` 中标记为"不可破坏"的约束
- ❌ 使用 `any` 类型
- ❌ 在非 socket 目录处理 Socket.IO 事件

---

## 新增功能检查清单

- [ ] 是否读了 DESIGN.md？
- [ ] 是否复用了已有服务/工具？
- [ ] 是否添加了类型注解？
- [ ] 是否使用了统一的响应格式（`createRes()`）？
- [ ] 是否更新了 DESIGN.md（如新增模块）？
