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

// ==================== ConversationStore 日志 Payload ====================

export type StoreAppendMessagePayload = {
  sessionId: string;
  requestId: string;
  messageId: string;
  role: string;
  sortIndex: number;
  contentPreview: string;
  hasToolCalls: boolean;
  toolCallId?: string | null;
};

export type StoreLLMContextPayload = {
  sessionId: string;
  totalMessages: number;
  useCompressed: boolean;
  maxToken?: number;
  truncated: boolean;
  beforeTruncate: number;
  afterTruncate: number;
  estimatedTokens: number;
  systemCount: number;
  chatCount: number;
  compressedCount: number;
};

export type StoreTruncatePayload = {
  beforeCount: number;
  afterCount: number;
  estimatedBefore: number;
  estimatedAfter: number;
  maxTokenLimit: number;
  protectedRounds: number;
  systemPreserved: boolean;
};

export type StoreFrontendDataPayload = {
  sessionId: string;
  totalMessages: number;
  totalRounds: number;
  compressedCount: number;
};

export type StoreSingleRoundPayload = {
  sessionId: string;
  requestId: string;
  messageCount: number;
  hasToolChain: boolean;
};

export type StoreCompressStatsPayload = {
  sessionId: string;
  totalMessages: number;
  compressedMessages: number;
  totalTokenSaved: number;
  snapshotCount: number;
};
