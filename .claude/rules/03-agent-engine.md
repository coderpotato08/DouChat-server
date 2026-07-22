# Agent 引擎模块规范

> 源码位置：`src/agent/engine/`

## 文件清单

| 文件 | 导出 | 职责 |
|------|------|------|
| `main-agent.ts` | `MainAgent`, `initMainAgent()`, `getMainAgent()` | 主 Agent 编排：agent loop、system prompt 构建、流式响应 |
| `llm-service.ts` | `LlmService`, `LlmClientBundle` | LLM 客户端管理：Provider 配置读取、OpenAI 客户端缓存 |
| `tool-manager.ts` | `ToolManager`, `RegisteredTool`, `DEFAULT_ALLOW_TOOLS` | 工具注册、工具配置导出、工具执行（含权限检查） |
| `hook-manager.ts` | `HookManager` | 事件 Hook 注册与触发（UserPromptSubmit/PreToolUse/PostToolUse/Stop） |

## 关键 API

### MainAgent

```
initMainAgent(): MainAgent          // 初始化单例
getMainAgent(): MainAgent           // 获取单例（未初始化时抛异常）
mainAgent.registerHooks(event, cb)  // 注册 Hook
mainAgent.sendThinkingStreamMessage(sessionId, requestId, userId, message, modelProvider, eventHandler?, abortSignal?)
mainAgent.createHttpStreamHandler(write)  // 创建 SSE 事件处理器
mainAgent.buildCompletionOptions(agentConfig)  // 构建 LLM 请求参数
```

### LlmService

```
llmService.getClientBundle(provider: "DOUBAO" | "QWEN"): LlmClientBundle
// 返回 { client: OpenAI, config: OpenAiEnvConfig, provider: LlmProviderName }
```

支持的 Provider：`DOUBAO`（豆包）、`QWEN`（通义千问）
环境变量前缀：`OPENAI_DOUBAO_*`、`OPENAI_QWEN_*`
环境变量后缀：`_API_KEY`、`_BASE_URL`、`_MODEL`（或 `_DEFAULT_MODAL`）

### ToolManager

```
toolManager.registerTool(tool: RegisteredTool): void
toolManager.registerTools(tools: RegisteredTool[]): void[]
toolManager.getToolsConfig(): ChatCompletionFunctionTool[]     // 给 LLM 的工具定义
toolManager.executeToolHandler(context, toolCallId, toolName, rawArgs): Promise<ToolExecutionResponse>
toolManager.registerHooks(event, callback): void               // 委托给 HookManager
```

### HookManager

支持的事件：`"UserPromptSubmit"` | `"PreToolUse"` | `"PostToolUse"` | `"Stop"`
`PreToolUse` 回调可返回 `{ block: boolean, reason?: string }` 来阻断工具执行
其他事件只触发不阻塞。

## 默认允许工具列表

定义在 `tool-manager.ts` 的 `DEFAULT_ALLOW_TOOLS`：
`safe_path`, `run_bash`, `run_read`, `run_write`, `task_create`, `task_get`, `task_list`, `task_update`

Task 工具已通过 `registerTaskTools()` 注册到 MainAgent；`todo` 工具源码保留但不再注册。

## Agent Loop 流程

```
sendThinkingStreamMessage()
  → complexityAnalyze(prompt)                    // 复杂度分析
  → hookManager.triggerHooks("UserPromptSubmit")  // Hook
  → for round in 0..maxToolRounds:
      → llmService.getClientBundle(provider)
      → client.chat.completions.create(messages)  // 非流式调用
      → if finish_reason === "stop": break
      → for each toolCall:
          → toolManager.executeToolHandler()
            → hookManager.triggerHooks("PreToolUse")  // 含权限检查
            → tool.execute(parsedArgs, context)               // context 显式传给工具
            → hookManager.triggerHooks("PostToolUse")
  → client.chat.completions.create(FINAL_MESSAGE)  // 流式输出最终回复
  → hookManager.triggerHooks("Stop")
```
