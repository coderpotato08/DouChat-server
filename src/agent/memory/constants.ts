// 消息角色枚举，对齐 OpenAI LLM 标准角色
export enum MessageRole {
  SYSTEM = "system",
  USER = "user",
  ASSISTANT = "assistant",
  TOOL = "tool",
}

// 上下文压缩策略枚举，支持后续无限扩展新算法
export enum CompressStrategy {
  // 轻量级冗余字符裁剪
  TOKEN_PRUNE = "token_prune",
  // 多轮对话合并语义摘要
  ROUND_ABSTRACT = "round_abstract",
  // 超长系统提示词轻量化精简
  SYSTEM_LIGHT = "system_light",
  // 多轮工具返回结果合并压缩
  TOOL_RESULT_MERGE = "tool_merge",
  // 轻量模型深度语义压缩（高阶扩展）
  LLM_SEMANTIC_SUMMARY = "llm_summary",
}

// 压缩触发模式枚举
export enum CompressTriggerMode {
  MANUAL = "manual",
  AUTO_TOKEN_THRESHOLD = "auto_token",
  IDLE_TIMEOUT = "idle_timeout",
}

// 全局运行时配置，支持运行时动态热更新
export interface StoreGlobalConfig {
  // 基础会话通用配置
  sortIndexStart: number;
  defaultSessionTTL: number;
  maxRawMessageLength: number;
  // 压缩失效兜底 Token 截断阈值
  fallbackTruncateTokenLimit: number;

  // 上下文压缩专属配置
  compress: {
    enableAutoCompress: boolean;
    tokenTriggerThreshold: number;
    // 最新 N 轮强制保护不压缩，默认 3 轮
    reserveLatestRounds: number;
    defaultStrategy: CompressStrategy;
    allowCompressSystemPrompt: boolean;
    allowCompressToolResult: boolean;
    // 会话闲置静默压缩延迟时长
    idleCompressDelayMs: number;
  };
}

// 默认全局配置
export const DEFAULT_STORE_CONFIG: StoreGlobalConfig = {
  sortIndexStart: 0,
  // 30 天 TTL（毫秒）
  defaultSessionTTL: 2592000000,
  maxRawMessageLength: 100000,
  fallbackTruncateTokenLimit: 128000,
  compress: {
    enableAutoCompress: false,
    tokenTriggerThreshold: 64000,
    reserveLatestRounds: 3,
    defaultStrategy: CompressStrategy.TOKEN_PRUNE,
    allowCompressSystemPrompt: false,
    allowCompressToolResult: true,
    // 5 分钟闲置
    idleCompressDelayMs: 300000,
  },
};
