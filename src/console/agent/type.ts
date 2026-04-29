export type AgentSessionStartPayload = {
  sessionId: string;
  userId: string;
  model?: string;
  message: string;
};

export type AgentRoundPayload = {
  round: number;
  messageCount: number;
};

export type AgentResponsePayload = {
  round: number;
  finishReason: string | null | undefined;
  toolCallCount: number;
  contentPreview?: string;
};

export type AgentToolStartPayload = {
  round: number;
  toolName: string;
  toolCallId?: string;
  input?: string;
};

export type AgentToolDonePayload = {
  round: number;
  toolName: string;
  toolCallId?: string;
  success: boolean;
  executionTime: number;
  output?: unknown;
  error?: string;
};

export type AgentSessionDonePayload = {
  roundsCompleted: number;
  finishReason?: string | null;
  reachedMaxRounds?: boolean;
};

export type AgentSessionErrorPayload = {
  round: number;
  error: unknown;
};
