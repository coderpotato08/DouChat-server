import type {
  ComplexityAnalyzeResult,
  ComplexityLevel,
  ComplexityRouteTarget,
} from "../../agent/sub-agent/complexity-analyze-agent";

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

export type AgentIntentRecognizedPayload = {
  success: boolean;
  durationMs: number;
  complexityLevel: ComplexityLevel;
  confidence: ComplexityAnalyzeResult["confidence"];
  routeTarget: ComplexityRouteTarget;
  tokenCost: ComplexityAnalyzeResult["tokenCost"];
  judgeFactors: ComplexityAnalyzeResult["judgeFactors"];
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
