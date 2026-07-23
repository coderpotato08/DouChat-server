# DouChat Server

> 基于 **Koa + MongoDB + Socket.IO** 的聊天后端，内置一套**自研 AI Agent 引擎**——用户通过自然语言对话，Agent 可在受控权限下调用工具执行 bash 命令、读写文件、管理任务。

---

## ✨ 亮点

| | 亮点 | 说明 |
|---|------|------|
| 🧠 | **自研 Agent 引擎** | 单 Agent Loop 编排：非流式工具决策轮 + 末轮真实流式输出，省 token 且体验流畅 |
| 🎯 | **复杂度路由** | 轻量子代理先分析 prompt 复杂度，动态决定 thinking 开关 / 温度 / 工具轮次预算 |
| 🗜️ | **三层上下文压缩管线** | L3 大结果落盘 → L1 对话裁剪 → L2 旧结果占位，每轮自动触发，含快照与熔断 |
| 🔐 | **三层权限 + Human-in-the-loop** | sandbox 硬约束 / preflight 会话黑名单 / confirm 人工审批，敏感命令 SSE 推送确认 |
| 🧵 | **请求级 AgentContext** | 不可变上下文显式透传，根治单例 Agent 并发请求间 SSE 处理器串台 |
| 📋 | **磁盘持久化 Task 系统** | 会话级任务 + 自动依赖同步 + 环检测 + 原子写与回滚 |
| 🔌 | **双 LLM Provider** | 豆包 (DOUBAO) / 通义千问 (QWEN) 统一管理，按 provider 适配 thinking 参数 |
| 💬 | **完整聊天后端** | JWT 认证 / 通讯录 / 私聊群聊 / 会议 / 文件上传 / Socket.IO 实时通信 |

---

## 🛠 技术栈

**运行时**：Node.js · TypeScript 5
**Web**：Koa · Koa-Router · Socket.IO
**数据**：MongoDB · Mongoose
**AI**：OpenAI SDK · Zod
**工程**：PM2 · ESLint · ts-node-dev · node:test

---

## 🏗 架构总览

```
HTTP POST /ai/agent/completion (SSE)
  └─ validateRequest (Zod)
     └─ agentCompletion()
        └─ bashBlacklistStore.runWithSession(requestId, …)   # 绑定会话上下文
           └─ mainAgent.sendThinkingStreamMessage(context)
              ├─ complexityAnalyze(prompt)                    # 复杂度路由
              ├─ hookManager.triggerHooks("UserPromptSubmit")
              ├─ agent loop (maxToolRounds):
              │    ├─ llmService.getClientBundle(provider)
              │    ├─ client.chat.completions.create(stream:false)   # 工具决策轮(非流式)
              │    └─ toolManager.executeToolHandler()
              │         ├─ triggerHooks("PreToolUse")  # 权限检查 + 人工审批
              │         ├─ tool.execute(args, context)
              │         └─ triggerHooks("PostToolUse")
              ├─ client.chat.completions.create(stream:true)         # 末轮(真实流式)
              ├─ ContextCompressor.compressSession()          # 每轮触发压缩管线 L3→L1→L2
              └─ hookManager.triggerHooks("Stop")
```

> 单向依赖：`controllers → agent/engine → {llm-service, tool-manager, hook-manager}`，Agent 引擎层不依赖 Koa Context，与前端通信全部通过 `EventHandler` 回调转 SSE。

---

## 🔍 核心设计亮点

### 1. Agent Loop：非流式决策 + 末轮流式输出

工具决策轮使用**非流式**调用（只关心 `tool_calls`，丢弃草稿），仅当模型不再调用工具时进入**末轮流式**生成最终答案。避免工具循环阶段浪费输出 token，同时保证最终回复的流式打字体验。达到最大轮次时注入 `FINAL_MESSAGE` 兜底。

### 2. 复杂度路由（`complexity-analyze-agent`）

每轮先用轻量子代理分析 prompt，输出 `complexityLevel` (simple/medium/complex) 与 `routeTarget`：

| routeTarget | thinking | temperature | maxLoopLimit |
|-------------|:--------:|:-----------:|:------------:|
| `direct_answer` | ❌ | 0.2 | 5 |
| `light_thinking` | ✅ | 0.3 | 5 |
| `agent_loop` | ✅ | 0.4 | 20 |

简单问题直接回答、省 thinking 成本；复杂任务才放开完整 agent loop 与高轮次预算。

### 3. 三层上下文压缩管线（`memory/compressor`）

每轮 `appendMessage` 后由 `ConversationStore` 触发，累计 token 超阈值时执行 L3 → L1 → L2：

| 阶段 | 名称 | 触发条件 | 动作 | 可逆性 |
|------|------|---------|------|:------:|
| **L3** | ToolResultBudget | 工具结果总量超阈值 | 最大的若干结果落盘，content 替换为 `<persisted-result>` 占位符 | 磁盘回滚 |
| **L1** | SnipCompact | 消息总数 > 50 | 保留头部 N + 尾部 M，裁剪中间段落（不拆 assistant+tool 对） | 落档 `.transcript/` |
| **L2** | MicroCompact | 旧工具结果 | 旧结果占位压缩 | — |

配套 **快照管理**、**CircuitBreaker 熔断器**、**磁盘持久化**，单条落库失败不阻断管线。

### 4. 三层权限策略 + Human-in-the-loop（`agent/permission`）

```
工具执行前 → checkCommandPermissionRules()
  ├─ 1. sandbox    路径/工作目录硬约束校验
  ├─ 2. preflight  会话级 bash 黑名单前置拒绝
  └─ 3. confirm    命中敏感命令 → askUserForPermission()
                       ├─ SSE 推送审批请求到前端
                       ├─ permissionStore.waitForDecision() 挂起
                       └─ 前端 POST /ai/agent/permission → 唤醒
```

- **危险命令**（`rm -rf` / `find /` / `git reset --hard` / `sudo` 等）：强制拦截 + 记入会话黑名单 + 注入后续 system prompt
- **会话级黑名单**：累计触发 2 次后**收回 `run_bash` 工具权限**
- **敏感命令**（`git commit/push` / `>` 重定向 / `npm install` 等）：转人工确认

### 5. 请求级 AgentContext（`engine/agent-context`）

`MainAgent` 是单例，但每次请求创建**不可变 `AgentContext`**（`requestId` / `sessionId` / `userId` / `modelProvider` / `eventHandler` / `abortSignal`），沿调用链显式透传。避免并发请求间覆盖请求状态和 SSE 事件处理器——这是单例 Agent 并发安全的根。

### 6. 磁盘持久化 Task 系统（`tools/TaskTool`）

`task_create/get/list/update` 以 `sessionId` 隔离，持久化到 `data/.douchat/task/{sessionId}/task_<uuidv7>.json`：
- `blockedBy` 与反向 `blocks` **自动同步**
- 禁止缺失依赖 / 自依赖 / 依赖环
- 前置任务未完成不得推进下游；已推进下游的前置不得回退
- 单文件**临时文件 + rename 原子替换**；多任务依赖更新**快照批量写入 + 尽力回滚**

---

## 📁 目录结构

```
src/
├── app/                 # MongoDB 连接 / Socket.IO 初始化
├── controllers/         # HTTP 路由处理层（含 ai/）
├── routes/              # Koa 路由注册
├── middleware/          # Zod 请求校验中间件
├── models/              # Mongoose 模型 + 统一响应 createRes()
├── jwt/                 # JWT 签发/验证
├── constant/            # 常量定义
├── utils/               # 纯工具函数（含 SSE 会话）
├── console/             # 领域日志系统
└── agent/               # 🧠 AI Agent 引擎（自包含）
    ├── engine/          #   main-agent / llm-service / tool-manager / hook-manager / agent-context
    ├── sub-agent/       #   complexity-analyze-agent（复杂度路由）
    ├── tools/           #   baseTools / TaskTool / TodoManagerTool
    ├── permission/      #   三层权限策略 + 黑名单 + 人工审批
    ├── memory/          #   conversation-store + compressor 管线 + formatters
    ├── handlers/        #   stream-handler（SSE 事件流转换）
    └── types/           #   agent / tools 类型
```

---

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18
- MongoDB ≥ 6.0
- 豆包 / 通义千问 API Key

### 安装与配置

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
#   填写 MONGOOSE_URL、OPENAI_QWEN_*、OPENAI_DOUBAO_* 等
```

需要的环境变量（详见 `.env.example`）：

| 变量 | 说明 |
|------|------|
| `PORT` | 服务端口 |
| `MONGOOSE_URL` | MongoDB 连接串 |
| `OPENAI_QWEN_API_KEY` / `OPENAI_QWEN_BASE_URL` / `OPENAI_QWEN_DEFAULT_MODAL` | 通义千问配置 |
| `OPENAI_DOUBAO_API_KEY` / `OPENAI_DOUBAO_BASE_URL` / `OPENAI_DOUBAO_DEFAULT_MODAL` | 豆包配置 |
| `LANGSMITH_*` | LangSmith 链路追踪（可选） |

### 启动

```bash
# 开发（热重载）
npm run server

# 生产构建 + PM2
npm run pm2:start
```

### 核心 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/ai/agent/init` | 初始化 MainAgent 单例 |
| POST | `/ai/agent/completion` | SSE 流式 AI 对话（主入口） |
| POST | `/ai/agent/permission` | 人工审批决策响应 |
| POST | `/ai/agent/approval/*` | Agent 审批流程 |

---

## 🧪 测试

```bash
npm test   # node --import tsx --test src/**/*.test.ts
```

覆盖：压缩管线（`compression-pipeline.test.ts`）、Task 依赖图（`task-manager.test.ts`）、ToolManager（`tool-manager.test.ts`）。

---

## 📚 文档

- [`DESIGN.md`](./DESIGN.md) — 项目设计总览与架构决策 (ADR)
- [`.claude/rules/`](./.claude/rules/) — 模块级编码规范（架构 / TS / Agent 引擎 / 工具 / 权限 / HTTP）
- [`docs/plan/`](./docs/plan/) — 设计方案（权限、Task 工具、会话存储 v2、压缩管线）

---

## 📝 开发备忘

**启动 MongoDB**

```bash
# 新（推荐，不带自定义配置）
brew services start mongodb-community@8.0

# 老（指定配置）
mongod --config /usr/local/mongodb/mongo/conf/mongo.conf
```

**WebRTC 调试**：Chrome 打开 `chrome://webrtc-internals/`

**MongoDB 聚合查询优化**：用 `$match` + `$lookup` 聚合管道代替 `find` + `populate`，更接近原生语法且性能更优。
