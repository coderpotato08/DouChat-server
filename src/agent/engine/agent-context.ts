import type { EventHandler, LlmProviderName } from "../types/agent";

// 单次 Agent 请求生命周期内共享的不可变上下文。
export type AgentContext = {
  readonly requestId: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly modelProvider: LlmProviderName;
  readonly eventHandler?: EventHandler;
  readonly abortSignal?: AbortSignal;
};

export function createAgentContext(context: AgentContext): AgentContext {
  return Object.freeze({ ...context });
}
