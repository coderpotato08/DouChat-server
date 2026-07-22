import OpenAI from "openai";

export const LLM_PROVIDER_NAMES = ["DOUBAO", "QWEN"] as const;

// 当前支持的模型提供商名称联合类型。
export type LlmProviderName = (typeof LLM_PROVIDER_NAMES)[number];

// Agent 运行时依赖的环境配置集合。
export type EnvConfig = {
  openAI: OpenAiEnvConfig;
};

// 单个 OpenAI 兼容模型服务的连接配置。
export type OpenAiEnvConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

// Agent 生命周期结束时的停止原因。
export type AgentStopReason = "completed" | "stop" | "max_tool_rounds" | "error";

// 所有 hook 上下文共享的基础字段。
export type AgentHookBaseContext = {
  requestId: string;
  userId: string;
  modelProvider: LlmProviderName;
};

// 用户提交 prompt 时触发的 hook 上下文。
export type UserPromptSubmitHookContext = AgentHookBaseContext & {
  prompt: string;
};

// 工具执行前触发的 hook 上下文，包含工具入参与事件处理能力。
export type PreToolUseHookContext = AgentHookBaseContext & {
  toolCallId: string;
  toolName: string;
  rawArgs?: string;
  parsedArgs: Record<string, any>;
  requestPermission?: (message: string) => Promise<boolean>;
};

// PreToolUse hook 的结构化返回结果，用于控制是否中断后续执行。
export type PreToolUseHookResult = {
  block: boolean;
  reason?: string;
};

// 工具执行完成后触发的 hook 上下文，包含执行结果。
export type PostToolUseHookContext = AgentHookBaseContext & {
  toolCallId: string;
  toolName: string;
  rawArgs?: string;
  parsedArgs: Record<string, any>;
  toolResult: unknown;
};

// Agent 停止时触发的 hook 上下文。
export type StopHookContext = AgentHookBaseContext & {
  prompt: string;
  reason: AgentStopReason;
  error?: Error;
};

// Agent 支持注册的全部 hook 事件及其回调签名。
export type AgentHooks = {
  UserPromptSubmit?: (context: UserPromptSubmitHookContext) => Promise<void> | void;
  PreToolUse?: (
    context: PreToolUseHookContext,
  ) => Promise<PreToolUseHookResult | void> | PreToolUseHookResult | void;
  PostToolUse?: (context: PostToolUseHookContext) => Promise<void> | void;
  Stop?: (context: StopHookContext) => Promise<void> | void;
};

// Hook 事件名称联合类型。
export type AgentHookEventName = keyof AgentHooks;

// 指定事件名后可推导出的 hook 回调函数类型。
export type AgentHookCallback<TEventName extends AgentHookEventName> = NonNullable<AgentHooks[TEventName]>;

// Hook 事件名称与其上下文类型之间的映射。
export type AgentHookContextMap = {
  UserPromptSubmit: UserPromptSubmitHookContext;
  PreToolUse: PreToolUseHookContext;
  PostToolUse: PostToolUseHookContext;
  Stop: StopHookContext;
};

// Hook 事件名称与 trigger 执行返回值之间的映射。
export type AgentHookTriggerResultMap = {
  UserPromptSubmit: void;
  PreToolUse: PreToolUseHookResult | undefined;
  PostToolUse: void;
  Stop: void;
};

// 对外透出的流式事件回调协议，供 SSE/HTTP 等上层消费。
export type EventHandler = {
  onContentStart?: () => Promise<void>;
  onContentDelta?: (delta: string) => Promise<void>;
  onContentDone?: () => Promise<void>;
  onThinkingStart?: () => Promise<void>;
  onThinkingDelta?: (delta: string) => Promise<void>;
  onThinkingDone?: () => Promise<void>;
  onToolUseStart?: (toolName: string, toolUseId: string, data: unknown) => Promise<void>;
  onToolUseDone?: (toolName: string, toolUseId: string, success: boolean, data: unknown) => Promise<void>;
  onPermissionRequest?: (requestId: string, message: string) => Promise<void>;
  onError?: (error: Error) => Promise<void>;
};

// 对 chat completion 请求参数的裁剪类型，消息体由调用方单独注入。
export type ChatCompletionBaseParams = Omit<
  OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  "messages"
>;

export const SYSTEM_PROMPT = `你是运行在 ${process.cwd()} 的编程助手（coding agent），通过工具调用在当前项目工作区内理解需求、读写文件、执行命令并交付结果。

## 工作环境
- 所有文件与命令操作都被限制在当前项目工作区内，越界路径会被拦截。
- 你的全部能力来自工具调用；不要凭空臆断文件内容或命令结果，需要信息就主动读取或执行。

## 工具集
规划与跟踪（会话级持久化任务）：
- task_create / task_get / task_list / task_update：创建、查询、列出、更新任务，并维护依赖关系。
执行与操作：
- run_read：读取文件内容，可按行区间读取。
- run_write：写入文件，可追加或覆盖。
- run_bash：在项目工作区内执行 bash 命令。
- safe_path：解析并校验路径是否位于工作区沙箱内。

## 任务管理纪律
- 多步工作先拆解：用 task_create 建立任务，必要时用 blockedBy 声明前置依赖。
- 开始任务前用 task_update 置为 in_progress，完成后置为 completed；blocks 由系统自动维护，不要手动修改。
- 严格遵守 blockedBy 依赖：前置任务未全部 completed 前，不得推进下游任务。
- 单步、可直接回答的问题无需创建任务。

## 执行与安全
- 改动前先读：写入或执行前先用 run_read 确认现状，避免覆盖或误操作。
- 禁止生成高危命令（如 rm -rf、强制 git 操作、提权命令等）。命中黑名单的命令模板会在本轮会话被持续禁止，多次触发将临时收回 run_bash 权限。
- 工具调用失败时阅读返回的错误信息并修正，不要重复提交相同的失败请求。

## 输出约定
- 工具循环中优先用工具收集信息、执行操作，不要把时间花在口头描述打算做什么。
- 信息足以作答时即停止调用工具，最终用简洁的自然语言给出答案。`;
export const FINAL_MESSAGE = "请基于上面的对话和工具结果给出最终答案，不要再次调用任何工具。";
