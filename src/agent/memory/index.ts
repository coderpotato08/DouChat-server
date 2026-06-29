// ==================== 单例访问 ====================
export {
  initConversationStore,
  getConversationStore,
  ConversationStore,
} from "./conversation-store";
export type { AppendMessageInput, SessionCompressStats } from "./conversation-store";

// ==================== 类型别名（数据库实体） ====================
export type { ChatMessageEntity, CompressSnapshotEntity } from "./mongo-repo";

// ==================== 格式化类型 ====================
export type { RawLLMMessage } from "./formatters/llm-formatter";
export type {
  FrontendBaseMsg,
  FrontendChatRound,
} from "./formatters/frontend-formatter";

// ==================== 压缩类型 ====================
export type { CompressResult } from "./compressor/context-compressor";
export type {
  CompressTokenStats,
  ICompressStrategy,
} from "./compressor/strategy-factory";

// ==================== 枚举 ====================
export { MessageRole, CompressStrategy, CompressTriggerMode } from "./constants";
export type { StoreGlobalConfig } from "./constants";

// ==================== 异常 ====================
export {
  StoreError,
  SessionNotFoundError,
  CompressStrategyNotFoundError,
  MessageRollbackFailedError,
  MessageValidateError,
} from "./errors";

// ==================== 工具类（供高级/扩展场景使用） ====================
export { IdGenerator } from "./id-generator";
export type { IdType } from "./id-generator";
export { MessageValidator } from "./message-validator";
export { ContextTruncator } from "./context-truncator";
