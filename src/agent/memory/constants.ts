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

    // ===== 每轮自动管线（执行顺序 L3->L1->L2）=====
    pipeline: {
      l1: {
        // 触发裁剪的消息条数阈值
        roundThreshold: number;
        // 保留头部条数（初始目标）
        keepHead: number;
        // 保留尾部条数（当前任务）
        keepTail: number;
      };
      l2: {
        // 保留最近工具结果条数，更早的替换为占位符
        keepRecentToolResults: number;
      };
      l3: {
        // 工具结果总量阈值（token），超出则按体积降序落盘
        toolResultBudgetTokens: number;
      };
    };
    // 熔断器（仅 autoCompact）：连续失败次数阈值
    circuitBreakerFailureThreshold: number;
    // 磁盘落盘根目录（L3 工具结果文件 + .transcript/ JSONL）
    diskRootDir: string;
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
    pipeline: {
      l1: { roundThreshold: 50, keepHead: 3, keepTail: 10 },
      l2: { keepRecentToolResults: 10 },
      l3: { toolResultBudgetTokens: 8000 },
    },
    circuitBreakerFailureThreshold: 3,
    diskRootDir: ".douchat-compress",
  },
};
