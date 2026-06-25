# HTTP 层规范

> 源码位置：`src/controllers/`, `src/middleware/`, `src/routes/`

## 控制器规范

- Controller 只做参数提取和响应，不包含业务逻辑
- 禁止在 controller 中直接操作数据库
- 禁止在 controller 中访问 Agent 内部状态

### AI Controller（`src/controllers/ai/`）

| 函数 | 路由 | 说明 |
|------|------|------|
| `initAgent` | `POST /ai/agent/init` | 初始化 MainAgent 单例 |
| `agentCompletion` | `POST /ai/agent/completion` | SSE 流式 AI 对话（主入口） |
| `agentPermission` | `POST /ai/agent/permission` | 人工审批决策响应 |

## Zod 校验中间件

`src/middleware/validate-request.ts` 提供：

```ts
// 工厂函数：创建校验中间件
validateRequest(schemas: { body?, query?, params? }, options?)

// 获取校验后的数据（在 controller 中使用）
getValidatedRequestData<TBody, TQuery, TParams>(ctx)
```

### AI 接口 Schema（`src/controllers/ai/validator.ts`）

```ts
agentCompletionBodySchema = z.object({
  prompt: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  modelProvider: z.enum(["DOUBAO", "QWEN"]).default("DOUBAO"),
})

agentPermissionBodySchema = z.object({
  requestId: z.string().trim().min(1),
  allow: z.boolean(),
})
```

## 路由注册

`src/routes/index.ts` 汇总所有子路由并 `app.use()` 到 Koa 实例。

AI 路由前缀：`/ai`
- `/ai/agent/init` → `initAgent`
- `/ai/agent/completion` → `validateRequest` → `agentCompletion`
- `/ai/agent/permission` → `validateRequest` → `agentPermission`
- `/ai/agent/approval/startTask` → `startTask`
- `/ai/agent/approval/approveTask` → `approvalTask`

## 统一响应格式

```ts
import { createRes } from "../models/responseModel";
ctx.body = createRes(code, data, message);
```

## SSE 流会话

```ts
import { createSSESession } from "../utils/sse-utils";
const sseSession = createSSESession(ctx);
sseSession.stream.write(chunk);  // 写入 SSE 数据
sseSession.sendError(message);   // 发送错误并关闭
sseSession.close();              // 关闭连接
sseSession.isClosed();           // 检查是否已关闭
```
