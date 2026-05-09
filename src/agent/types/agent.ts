import OpenAI from "openai";

export type EnvConfig = {
  openAI: OpenAiEnvConfig;
};

export type OpenAiEnvConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type EventHandler = {
  onContentStart?: () => Promise<void>;
  onContentDelta?: (delta: string) => Promise<void>;
  onContentDone?: () => Promise<void>;
  onThinkingStart?: () => Promise<void>;
  onThinkingDelta?: (delta: string) => Promise<void>;
  onThinkingDone?: () => Promise<void>;
  onToolUseStart?: (toolName: string, toolUseId: string, input?: string) => Promise<void>;
  onToolUseDone?: (toolName: string, toolUseId: string, output: string) => Promise<void>;
  onError?: (error: Error) => Promise<void>;
}

export type ChatCompletionBaseParams = Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, "messages">

export const SYSTEM_PROMPT = `You are a coding agent at ${process.cwd()}. Use the todo tool to plan multi-step tasks. Mark in_progress before starting, completed when done. Prefer tools over prose.`;
export const FINAL_MESSAGE = '请基于上面的对话和工具结果给出最终答案，不要再次调用任何工具。';