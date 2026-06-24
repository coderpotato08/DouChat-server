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
  onToolUseStart?: (toolName: string, toolUseId: string, input?: string) => Promise<void>;
  onToolUseDone?: (toolName: string, toolUseId: string, output: string) => Promise<void>;
  onPermissionRequest?: (requestId: string, message: string) => Promise<void>;
  onError?: (error: Error) => Promise<void>;
};

// 对 chat completion 请求参数的裁剪类型，消息体由调用方单独注入。
export type ChatCompletionBaseParams = Omit<
  OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  "messages"
>;

export const SYSTEM_PROMPT = `You are a coding agent at ${process.cwd()}. Use the todo tool to plan multi-step tasks. Mark in_progress before starting, completed when done. Prefer tools over prose.`;
export const FINAL_MESSAGE = "请基于上面的对话和工具结果给出最终答案，不要再次调用任何工具。";
