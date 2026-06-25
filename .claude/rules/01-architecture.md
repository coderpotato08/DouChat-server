# 架构约束

> 关联：[[DESIGN]]

## 目录结构约定

- `src/controllers/` — HTTP 路由处理层，只做参数提取和响应，不包含业务逻辑
- `src/models/` — Mongoose 数据模型 + `responseModel.ts`（`createRes` 统一响应）
- `src/middleware/` — Koa 中间件
- `src/routes/` — Koa 路由注册
- `src/agent/` — AI Agent 引擎，完全自包含，不依赖 HTTP 层
- `src/utils/` — 纯工具函数，不依赖 Koa Context
- `src/console/` — 日志系统
- `src/constant/` — 常量定义
- `src/jwt/` — JWT 签发/验证

## 不可破坏的约束

1. ❌ controller 中禁止直接操作数据库（Mongoose Model）
2. ❌ controller 中禁止访问 MainAgent 私有字段
3. ❌ 禁止绕过 `LlmService.getClientBundle()` 直接 `new OpenAI()`
4. ❌ 禁止新增工具但不通过 `ToolManager.registerTools()` 注册
5. ❌ 禁止新增权限规则但不更新 `src/agent/permission/index.ts` 中的 `toolPermissionPolicies`

## 调用链约束

- HTTP 请求 → validateRequest → controller → MainAgent（单向依赖）
- Agent 引擎层不依赖 Koa Context，不导入 HTTP 相关模块
- 所有 Agent → 前端的通信通过 `EventHandler` 接口回调，由 `StreamHandler` 转换成 SSE

## 模块间依赖方向

```
controllers → agent/engine/main-agent  (单向)
agent/engine/main-agent → agent/engine/llm-service  (单向)
agent/engine/main-agent → agent/engine/tool-manager  (单向)
agent/engine/main-agent → agent/engine/hook-manager  (单向)
agent/engine/tool-manager → agent/permission  (单向)
agent/engine/tool-manager → agent/handlers/stream-handler  (单向)
agent/permission → agent/engine/hook-manager  (不依赖)
```
