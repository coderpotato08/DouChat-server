# DouChat Server · 项目设计总览

> **AI 编码必读**：本文档是项目的"设计记忆"，记录高层架构与决策。修改任何代码前，请先阅读本文档。
> 各模块的详细实现规范见 `.claude/rules/` 目录（与本文档互补，本文档管"为什么"，rules 管"怎么做"）。

---

## 1. 项目概述

DouChat 是一个基于 **Koa + MongoDB + Socket.IO** 的聊天后端，内置自研 AI Agent 引擎。
用户通过自然语言与 AI 交互，AI Agent 可以调用工具执行 bash 命令、读写文件。

**技术栈**：Node.js + TypeScript | Koa | MongoDB (Mongoose) | Socket.IO | OpenAI SDK | Zod

---

## 2. 目录结构 & 模块职责

```
src/
├── index.ts                          # 启动入口（MongoDB连接 → HTTP监听）
├── app/
│   ├── dbConnect.ts                  # MongoDB 连接管理
│   └── socket.ts                     # Socket.IO 服务器初始化
│
├── models/                           # 数据持久层（Mongoose）
│   ├── usersModel.ts                 #   用户模型
│   ├── friendsModel.ts               #   好友关系模型
│   ├── userContactsModel.ts          #   用户通讯录模型
│   ├── userMessageModel.ts           #   用户私聊消息模型
│   ├── groupsModel.ts                #   群组模型
│   ├── groupUserModel.ts             #   群组用户模型
│   ├── groupContactsModel.ts         #   群组通讯录模型
│   ├── groupMessageModel.ts          #   群聊消息模型
│   ├── groupMessageReadModel.ts      #   群聊消息已读模型
│   ├── groupNotificationModel.ts     #   群组通知模型
│   ├── friendNotificationModel.ts    #   好友通知模型
│   ├── meetingModel.ts               #   会议模型
│   ├── aiSessionModel.ts             #   AI 会话模型
│   ├── aiSessionMessageModel.ts      #   AI 会话消息模型
│   └── responseModel.ts              #   统一 HTTP 响应格式（createRes）
│
├── controllers/                      # HTTP 路由处理层
│   ├── authController.ts             #   认证（登录/登出/注册）
│   ├── userController.ts             #   用户 CRUD
│   ├── contactsController.ts         #   通讯录管理
│   ├── messageController.ts          #   消息管理
│   ├── groupController.ts            #   群组管理
│   ├── meetingController.ts          #   会议管理
│   ├── notificationController.ts     #   通知管理
│   ├── uploadController.ts           #   文件上传
│   ├── approvalController.ts         #   Agent 审批流程
│   └── ai/
│       ├── controller.ts             #   AI Agent HTTP 接口（init/completion/permission）
│       └── validator.ts              #   AI 接口 Zod Schema 定义
│
├── middleware/                        # Koa 中间件
│   └── validate-request.ts           #   Zod 请求校验中间件工厂（validateRequest + getValidatedRequestData）
│
├── routes/                           # Koa 路由注册
│   ├── index.ts                      #   路由汇总（app.use 所有子路由）
│   ├── authRoute.ts                  #   /auth/*
│   ├── userRoute.ts                  #   /user/*
│   ├── contactsRoute.ts              #   /contacts/*
│   ├── messageRoute.ts               #   /message/*
│   ├── groupRoute.ts                 #   /group/*
│   ├── meetingRoute.ts               #   /meeting/*
│   ├── notificationRoute.ts          #   /notification/*
│   ├── uploadRoute.ts                #   /upload/*
│   └── aiRoute.ts                    #   /ai/agent/init | completion | permission | approval/*
│
├── jwt/
│   └── Jwt.ts                        #   JWT 签发/验证
│
├── constant/                         # 常量定义
│   ├── apiTypes.ts                   #   API 类型常量
│   ├── auth.ts                       #   认证常量
│   ├── commonTypes.ts                #   通用类型常量
│   ├── errorData.ts                  #   错误码 & 错误消息
│   └── socketTypes.ts                #   Socket.IO 事件类型
│
├── utils/                            # 工具函数
│   ├── common-utils.ts               #   通用工具（formatMessageText, sleep）
│   └── sse-utils.ts                  #   SSE 流会话工具（createSSESession）
│
├── console/                          # 日志系统
│   ├── index.ts                      #   SystemLogger 统一入口
│   ├── base/index.ts                 #   BaseLog 基类
│   ├── agent/index.ts                #   AgentLog（agent 领域日志）
│   ├── agent/type.ts                 #   Agent 日志类型定义
│   ├── meeting/index.ts              #   MeetingLog
│   └── user/index.ts                 #   UserLog
│
└── agent/                            # 🧠 AI Agent 引擎
    ├── types/
    │   ├── agent.ts                  #   Agent 核心类型（LlmProviderName, EventHandler, AgentHooks, Hook 上下文等）
    │   └── tools.ts                  #   工具类型（ToolExecutionResponse）
    │
    ├── engine/
    │   ├── main-agent.ts             #   MainAgent — 主 Agent 编排（agent loop + 流式响应）
    │   ├── agent-context.ts          #   AgentContext — 请求级不可变上下文
    │   ├── llm-service.ts            #   LlmService — LLM 客户端管理（DOUBAO/QWEN 双 Provider）
    │   ├── tool-manager.ts           #   ToolManager — 工具注册/配置/执行（含 PreToolUse Hook）
    │   ├── hook-manager.ts           #   HookManager — 事件 Hook 注册与触发
    │   ├── design-doc.ts             #   DesignDocLoader — 设计文档自动注入器
    │
    ├── handlers/
    │   └── stream-handler.ts         #   StreamHandler — SSE 事件流转换
    │
    ├── sub-agent/
    │   └── complexity-analyze-agent.ts  # ComplexityAnalyzeAgent — 复杂度分析路由
    │
    ├── tools/
    │   ├── baseTools.ts              #   基础工具注册（safe_path, run_bash, run_read, run_write）
    │   ├── TodoManager/index.ts      #   TodoManager + todo 工具注册
    │
    ├── permission/
    │   ├── index.ts                  #   权限策略入口（toolPermissionPolicies, checkCommandPermissionRules）
    │   ├── permission-store.ts       #   PermissionStore — 人工审批决策挂起/唤醒
    │   ├── bash-blacklist-store.ts   #   BashBlacklistStore — 会话级 bash 黑名单
    │   └── bash-cmd-patterns.ts      #   危险/敏感命令模式定义
    │
    └── memory/
        ├── conversation-store.ts     #   ConversationStore — 单会话内存消息管理
        └── type.ts                   #   会话上下文类型定义
```

### 关联规范文件

各模块的详细实现约束见 `.claude/rules/` 目录：

| 关联模块 | 约束文档 |
|---------|---------|
| 架构 & 调用链 | `.claude/rules/01-architecture.md` |
| TypeScript 编码规范 | `.claude/rules/02-typescript.md` |
| Agent 引擎 | `.claude/rules/03-agent-engine.md` |
| Agent 工具系统 | `.claude/rules/04-agent-tools.md` |
| Agent 权限系统 | `.claude/rules/05-agent-permission.md` |
| HTTP 层 | `.claude/rules/06-http-layer.md` |

---

## 3. 调用链路

```
HTTP POST /ai/agent/completion (SSE)
  → validateRequest(agentCompletionBodySchema)  [Zod 校验]
    → ai/controller.ts: agentCompletion()
      → getMainAgent() / initMainAgent()
      → bashBlacklistStore.runWithSession(requestId, ...)  [绑定会话上下文]
      → mainAgent.sendThinkingStreamMessage(requestId, userId, message, modelProvider, eventHandler)
        → complexityAnalyze(prompt)                        [复杂度分析]
        → hookManager.triggerHooks("UserPromptSubmit", …)  [Hook: 用户提交]
        → agent loop (maxToolRounds 轮):
            → llmService.getClientBundle(provider)          [获取 LLM 客户端]
            → client.chat.completions.create(…)             [调用 LLM]
            → toolManager.executeToolHandler(…)             [执行工具]
              → hookManager.triggerHooks("PreToolUse", …)   [Hook: 工具前置]
                → checkCommandPermissionRules(…)            [权限检查]
                → askUserForPermission(…)                   [人工审批]
              → tool.execute(parsedArgs)                    [工具实际执行]
              → hookManager.triggerHooks("PostToolUse", …)  [Hook: 工具后置]
        → 流式输出最终回复
        → hookManager.triggerHooks("Stop", …)               [Hook: 停止]
```

---

## 4. 架构决策（ADR）

### ADR-1: 单 Agent Loop 架构
- `MainAgent` 直接管理 agent loop，在循环内调用 LLM + 工具
- 没有 SubAgent 类——当前只有 `ComplexityAnalyzeAgent` 作为独立的轻量分析子代理
- MainAgent 通过 `ToolManager` 统一管理所有工具的注册和执行

### ADR-2: 三层权限策略
- **Sandbox**：路径/工作目录硬约束校验
- **Preflight**：会话黑名单前置拒绝
- **Confirm**：敏感操作转人工确认
- 权限策略表 `toolPermissionPolicies` 在 `src/agent/permission/index.ts` 中集中管理

### ADR-3: LLM 双 Provider
- 所有 LLM 调用必须通过 `LlmService.getClientBundle(provider)` 获取客户端
- 当前支持：`DOUBAO`（豆包）和 `QWEN`（通义千问）
- `LlmService` 位于 `src/agent/engine/llm-service.ts`，不是独立目录
- 禁止在业务代码中直接 `new OpenAI()`

### ADR-4: Zod 校验中间件
- 所有请求体校验使用 `middleware/validate-request.ts` 的 `validateRequest()` 工厂函数
- 新增路由必须定义 Zod Schema
- 禁止在 controller 中手动校验

### ADR-5: Hook 事件系统
- 四种事件：`UserPromptSubmit` | `PreToolUse` | `PostToolUse` | `Stop`
- `PreToolUse` 支持阻塞返回值（`{ block: true, reason: "…" }`），其他事件只触发不阻塞
- 注册入口：`MainAgent.registerHooks()` → 转发到 `HookManager`

### ADR-6: 会话级 Bash 黑名单
- 首次命中危险命令时记住模板
- 下次 `run_bash` 执行前做预校验
- 累计触发 2 次后收回 `run_bash` 工具权限
- 黑名单摘要注入 system prompt

### ADR-7: Agent 引擎模块单例模式
- `agent/` 下 mainAgent 架构的各模块尽量采用单例模式（`initXxx()` / `getXxx()`）
- 若子模块依赖同级模块，**不**通过单例 getter 间接获取，而是直接透传实例
- 避免模块间通过单例形成隐式耦合，保持依赖关系显式可追踪

### ADR-8: 请求级 AgentContext
- 每次 Agent 请求创建一个不可变 `AgentContext`，集中维护 `requestId`、`sessionId`、`userId`、`modelProvider`、`eventHandler` 和可选 `abortSignal`
- `MainAgent`、`ToolManager` 及消息持久化辅助方法沿调用链显式传递 context，避免重复传递独立参数
- `AgentContext` 不保存在 `MainAgent` 单例字段中，防止并发请求之间覆盖请求状态和 SSE 事件处理器
- 类型和创建函数集中定义在 `src/agent/engine/agent-context.ts`

---

## 5. 不可破坏的约束

### 架构约束
- ❌ controller 中**禁止**直接操作数据库
- ❌ **禁止**绕过 `LlmService.getClientBundle()` 直接 `new OpenAI()`
- ❌ controller 中**禁止**访问 MainAgent 私有字段
- ❌ **禁止**新增工具但不通过 `ToolManager.registerTools()` 注册
- ❌ **禁止**新增权限规则但不更新 `toolPermissionPolicies`

### 数据流约束
- ✅ API 响应统一用 `models/responseModel.ts` 的 `createRes()`
- ✅ 请求校验统一用 `middleware/validate-request.ts`
- ✅ LLM 调用统一用 `agent/engine/llm-service.ts`
- ✅ Agent 类型放 `agent/types/agent.ts`，工具类型放 `agent/types/tools.ts`

### 代码规范
- ✅ 文件名 kebab-case | 类名 PascalCase | 函数 camelCase | 常量 UPPER_SNAKE
- ✅ 所有函数有 TypeScript 类型注解
- ✅ 不用 `any`（除非有注释说明理由）

---

## 6. 已完成功能

| 功能 | 状态 | 涉及模块 |
|------|:----:|----------|
| 用户注册/登录 (JWT) | ✅ | controllers/auth, models/users, jwt/Jwt |
| 通讯录管理 | ✅ | controllers/contacts, models/friends, models/userContacts |
| 私聊/群聊消息 | ✅ | controllers/message, controllers/group, models/*Message |
| 会议管理 | ✅ | controllers/meeting, models/meeting |
| 文件上传 | ✅ | controllers/upload |
| AI 流式对话 (SSE) | ✅ | controllers/ai, agent/engine/main-agent |
| Agent Loop 编排 | ✅ | agent/engine/main-agent |
| LLM 双 Provider (DOUBAO/QWEN) | ✅ | agent/engine/llm-service |
| 4 个基础工具 (safe_path/run_bash/run_read/run_write) | ✅ | agent/tools/baseTools |
| TodoManager 工具 | ✅ | agent/tools/TodoManager |
| Hook 事件系统 | ✅ | agent/engine/hook-manager |
| 复杂度分析路由 | ✅ | agent/sub-agent/complexity-analyze-agent |
| 三层权限策略 (sandbox+preflight+confirm) | ✅ | agent/permission/index |
| 会话级 Bash 黑名单 | ✅ | agent/permission/bash-blacklist-store |
| 人工审批决策挂起/唤醒 | ✅ | agent/permission/permission-store |
| Zod 请求校验中间件 | ✅ | middleware/validate-request |
| SSE 流会话工具 | ✅ | utils/sse-utils |
| Agent 领域日志 | ✅ | console/agent |
| 设计文档自动注入器 | ✅ | agent/engine/design-doc |
| ConversationStore 会话管理 | ✅ | agent/memory/conversation-store |
