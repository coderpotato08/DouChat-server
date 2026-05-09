export type AgentSessionStartPayload = {
  sessionId: string;
  userId: string;
  model?: string;
  message: string;
};

export type AgentResponsePayload = {
  round: number;
  finishReason: string | null | undefined;
  toolCallCount: number;
  contentPreview?: string;
};

export type AgentToolStartPayload = {
  toolName: string;
  toolCallId?: string;
  input?: string;
};

export type AgentToolDonePayload = {
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
