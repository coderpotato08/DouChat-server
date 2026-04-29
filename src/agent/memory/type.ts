import OpenAI from "openai";
import {
  AiMessageContentType,
  AiMessageRole,
  AiMessageSenderType,
  AiMessageStatus,
  AiSessionMessageDocument,
} from "../../models/aiSessionMessageModel";

export type ConversationMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;
export type ConversationContextSegment = "head" | "summary" | "tail" | null;
export type ConversationMessageContent = unknown;

export interface ConversationStoreOptions {
  sessionId?: AiSessionMessageDocument["sessionId"];
  ownerUserId?: AiSessionMessageDocument["ownerUserId"];
  systemPrompt?: string;
  maxContextMessages?: number;
  initialMessages?: ConversationMessageSeed[];
}

export interface ConversationMessageSeed {
  seq?: number;
  senderType: AiMessageSenderType;
  role: AiMessageRole;
  content: ConversationMessageContent;
  contentType?: AiMessageContentType;
  messageStatus?: AiMessageStatus;
  tokenUsage?: AiSessionMessageDocument["tokenUsage"];
  extra?: AiSessionMessageDocument["extra"];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ConversationMessageRecord {
  sessionId?: AiSessionMessageDocument["sessionId"];
  ownerUserId?: AiSessionMessageDocument["ownerUserId"];
  seq: number;
  senderType: AiMessageSenderType;
  role: AiMessageRole;
  contentType: AiMessageContentType;
  content: ConversationMessageContent;
  messageStatus: AiMessageStatus;
  tokenUsage?: AiSessionMessageDocument["tokenUsage"];
  extra?: AiSessionMessageDocument["extra"];
  createdAt: Date;
  updatedAt: Date;
  includedInContext: boolean;
  summaryGroupId?: string;
  contextSegment: ConversationContextSegment;
  persisted: boolean;
}

export interface ConversationSummaryBlock {
  id: string;
  startSeq: number;
  endSeq: number;
  content: string;
  tokenEstimate?: number;
  updatedAt: Date;
}

export interface ConversationCompressionMeta {
  compressionVersion: number;
  compressedUntilSeq: number;
  lastBuildAt?: Date;
  tokenEstimate: number;
}

export interface ConversationContextMessageRecord {
  seq: number;
  role: AiMessageRole;
  senderType: AiMessageSenderType;
  content: ConversationMessageParam["content"];
  toolCallId?: string;
  contextSegment: Exclude<ConversationContextSegment, null>;
  source: "timeline" | "summary";
}

export interface ConversationContextState {
  headPinnedMessages: ConversationContextMessageRecord[];
  summaryBlocks: ConversationSummaryBlock[];
  tailWindowMessages: ConversationContextMessageRecord[];
  contextMessages: ConversationContextMessageRecord[];
  compressionMeta: ConversationCompressionMeta;
}

export interface ConversationSnapshot {
  sessionId?: AiSessionMessageDocument["sessionId"];
  ownerUserId?: AiSessionMessageDocument["ownerUserId"];
  nextSeq: number;
  dirty: boolean;
  messageTimeline: ConversationMessageRecord[];
  contextState: ConversationContextState;
}

export interface BuildContextOptions {
  includeSystemPrompt?: boolean;
  maxContextMessages?: number;
}

export interface AppendConversationMessageInput {
  senderType: AiMessageSenderType;
  role: AiMessageRole;
  content: ConversationMessageContent;
  contentType?: AiMessageContentType;
  messageStatus?: AiMessageStatus;
  tokenUsage?: AiSessionMessageDocument["tokenUsage"];
  extra?: AiSessionMessageDocument["extra"];
  createdAt?: Date;
}
