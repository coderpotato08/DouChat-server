import chalk from "chalk";
import BaseLog, { ArgTypeEnum, ConsoleArg } from "../base";
import {
  AgentIntentRecognizedPayload,
  AgentResponsePayload,
  AgentSessionDonePayload,
  AgentSessionErrorPayload,
  AgentSessionStartPayload,
  AgentToolDonePayload,
  AgentToolStartPayload,
  StoreAppendMessagePayload,
  StoreLLMContextPayload,
  StoreTruncatePayload,
  StoreFrontendDataPayload,
  StoreSingleRoundPayload,
  StoreCompressStatsPayload,
} from "./type";

const previewText = (value: unknown, maxLength = 120): string => {
  if (value === undefined || value === null) {
    return "";
  }

  const raw = typeof value === "string" ? value : JSON.stringify(value);
  const normalized = raw.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...[${normalized.length - maxLength} more chars]`;
};

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return previewText(error, 160) || "Unknown error";
};

const formatToolBadge = (label: string) => {
  return chalk.bgCyanBright.black(` ${label} `);
};

/**
 * Agent 领域日志实现：会话开始、轮次、工具、结束和异常节点
 * 都统一封装在同一个日志类中，直接作为 console 扩展使用。
 */
export default class AgentLog extends BaseLog {
  constructor(consoleArgs: ConsoleArg[] = []) {
    super(consoleArgs);
  }

  private withDefaults = (level: "info" | "error" = "info") => {
    let nextLog: this = this;
    const hasStatus = nextLog.consoleArgs.some(([type]) => type === ArgTypeEnum.STATUS);

    if (!hasStatus) {
      nextLog = level === "error" ? nextLog.error() : nextLog.info();
    }

    const hasTime = nextLog.consoleArgs.some(([type]) => type === ArgTypeEnum.TIME);
    if (!hasTime) {
      nextLog = nextLog.time();
    }

    return nextLog;
  };

  public sessionStart = (payload: AgentSessionStartPayload) => {
    return this.withDefaults().appendArgs(
      [ArgTypeEnum.TEXT, chalk.bgBlackBright.white.bold(" AGENT ")],
      [ArgTypeEnum.TEXT, chalk.cyan.bold(payload.sessionId)],
      [ArgTypeEnum.TEXT, `user=${chalk.green.bold(payload.userId)}`],
      [ArgTypeEnum.TEXT, payload.model ? `model=${chalk.yellow.bold(payload.model)}` : ""],
      [ArgTypeEnum.TEXT, chalk.gray(previewText(payload.message, 100) || "empty prompt")],
    );
  };

  public llmResponse = (payload: AgentResponsePayload) => {
    const preview = previewText(payload.contentPreview);
    return this.withDefaults().appendArgs(
      [ArgTypeEnum.TEXT, chalk.magenta.bold(`[LLM ${payload.round}]`)],
      [ArgTypeEnum.TEXT, `finish=${chalk.yellow.bold(payload.finishReason || "unknown")}`],
      [ArgTypeEnum.TEXT, `tools=${chalk.green.bold(payload.toolCallCount)}`],
      [ArgTypeEnum.TEXT, preview ? chalk.gray(preview) : chalk.gray("empty response")],
    );
  };

  public intentRecognized = (payload: AgentIntentRecognizedPayload) => {
    const nextLog = payload.success ? this.success().time() : this.warning().time();

    return nextLog.appendArgs(
      [ArgTypeEnum.TEXT, chalk.yellow.bold("[INTENT]")],
      [ArgTypeEnum.TEXT, `耗时：${chalk.cyan.bold(`${payload.durationMs}ms`)}`],
      [ArgTypeEnum.TEXT, `复杂度：${chalk.yellow.bold(payload.complexityLevel)}`],
      [ArgTypeEnum.TEXT, `置信度：${chalk.green.bold(payload.confidence)}`],
      [ArgTypeEnum.TEXT, `路由：${chalk.magenta.bold(payload.routeTarget)}`],
      [ArgTypeEnum.TEXT, `成本：${chalk.cyan.bold(payload.tokenCost)}`],
      [ArgTypeEnum.TEXT, chalk.gray(`判断因素：${payload.judgeFactors.join(" | ") || "无"}`)],
    );
  };

  public toolStart = (payload: AgentToolStartPayload) => {
    const inputPreview = previewText(payload.input);
    return this.withDefaults().appendArgs(
      [ArgTypeEnum.TEXT, formatToolBadge("TOOL START")],
      [ArgTypeEnum.TEXT, chalk.green.bold(payload.toolName)],
      [ArgTypeEnum.TEXT, payload.toolCallId ? chalk.gray(`#${payload.toolCallId}`) : ""],
      [ArgTypeEnum.TEXT, inputPreview ? chalk.gray(`input=${inputPreview}`) : chalk.gray("no input")],
    );
  };

  public toolDone = (payload: AgentToolDonePayload) => {
    const resultPreview = previewText(payload.success ? payload.output : payload.error);
    return this.withDefaults(payload.success ? "info" : "error").appendArgs(
      [ArgTypeEnum.TEXT, formatToolBadge("TOOL DONE")],
      [ArgTypeEnum.TEXT, chalk.green.bold(payload.toolName)],
      [ArgTypeEnum.TEXT, payload.toolCallId ? chalk.gray(`#${payload.toolCallId}`) : ""],
      [ArgTypeEnum.TEXT, `${chalk.cyan.bold(`${payload.executionTime}ms`)}`],
      [ArgTypeEnum.TEXT, resultPreview ? chalk.gray(`output=${resultPreview}`) : chalk.gray("no output")],
    );
  };

  public sessionDone = (payload: AgentSessionDonePayload) => {
    const suffix = payload.reachedMaxRounds ? "max rounds reached" : payload.finishReason || "stop";
    return this.withDefaults().appendArgs(
      [ArgTypeEnum.TEXT, chalk.green.bold("[SESSION DONE]")],
      [ArgTypeEnum.TEXT, `rounds=${chalk.green.bold(payload.roundsCompleted)}`],
      [ArgTypeEnum.TEXT, chalk.gray(suffix)],
    );
  };

  public sessionError = (payload: AgentSessionErrorPayload) => {
    return this.withDefaults("error").appendArgs(
      [ArgTypeEnum.TEXT, chalk.red.bold(`[SESSION ERROR ${payload.round}]`)],
      [ArgTypeEnum.TEXT, chalk.gray(formatError(payload.error))],
    );
  };

  // ==================== ConversationStore 日志方法 ====================

  private formatStoreBadge = (label: string) => {
    return chalk.bgCyan.black(` ${label} `);
  };

  /** 消息写入 */
  public storeAppendMessage = (payload: StoreAppendMessagePayload) => {
    const toolTag = payload.hasToolCalls
      ? chalk.yellow(" [tool_calls]")
      : payload.toolCallId
        ? chalk.yellow(` [tool_id=${payload.toolCallId}]`)
        : "";
    return this.withDefaults().appendArgs(
      [ArgTypeEnum.TEXT, this.formatStoreBadge("ADD MSG")],
      [ArgTypeEnum.TEXT, chalk.cyan(`session=${payload.sessionId}`)],
      [ArgTypeEnum.TEXT, chalk.magenta(`req=${payload.requestId}`)],
      [ArgTypeEnum.TEXT, chalk.green(`role=${payload.role}`)],
      [ArgTypeEnum.TEXT, `idx=${chalk.yellow(payload.sortIndex)}`],
      [ArgTypeEnum.TEXT, `msgId=${chalk.gray(payload.messageId)}`],
      [ArgTypeEnum.TEXT, toolTag],
      [ArgTypeEnum.TEXT, chalk.gray(`"${payload.contentPreview}"`)],
    );
  };

  /** LLM 上下文构建 */
  public storeLLMContext = (payload: StoreLLMContextPayload) => {
    const truncatedLabel = payload.truncated
      ? chalk.yellow(`truncated ${payload.beforeTruncate}→${payload.afterTruncate}`)
      : chalk.gray("no truncation");
    const maxTokenLabel = payload.maxToken
      ? chalk.cyan(`${payload.maxToken}`)
      : chalk.gray("unlimited");
    return this.withDefaults().appendArgs(
      [ArgTypeEnum.TEXT, this.formatStoreBadge("BUILD CTX")],
      [ArgTypeEnum.TEXT, chalk.cyan(`session=${payload.sessionId}`)],

      [ArgTypeEnum.TEXT, `total=${chalk.bold(payload.totalMessages)}`],
      [ArgTypeEnum.TEXT, `compressed=${payload.useCompressed ? chalk.green("yes") : chalk.gray("no")}`],
      [ArgTypeEnum.TEXT, `maxToken=${maxTokenLabel}`],
      [ArgTypeEnum.TEXT, truncatedLabel],
      [ArgTypeEnum.TEXT, `est=${chalk.yellow(`${payload.estimatedTokens} tok`)}`],
      [ArgTypeEnum.TEXT, `sys=${chalk.blue(payload.systemCount)}`],
      [ArgTypeEnum.TEXT, `chat=${chalk.blue(payload.chatCount)}`],
      [ArgTypeEnum.TEXT, `compressed=${chalk.magenta(payload.compressedCount)}`],
    );
  };

  /** 兜底截断 */
  public storeTruncate = (payload: StoreTruncatePayload) => {
    return this.withDefaults("info").appendArgs(
      [ArgTypeEnum.TEXT, this.formatStoreBadge("TRUNCATE")],
      [ArgTypeEnum.TEXT, `${chalk.yellow(payload.beforeCount)}→${chalk.yellow(payload.afterCount)}`],
      [ArgTypeEnum.TEXT, `est: ${chalk.red(`${payload.estimatedBefore} tok`)}→${chalk.green(`${payload.estimatedAfter} tok`)}`],
      [ArgTypeEnum.TEXT, `limit=${chalk.cyan(payload.maxTokenLimit)}`],
      [ArgTypeEnum.TEXT, `protected=${chalk.magenta(payload.protectedRounds)} rounds`],
      [ArgTypeEnum.TEXT, `sys=${payload.systemPreserved ? chalk.green("preserved") : chalk.red("trimmed")}`],
    );
  };

  /** 前端数据构建 */
  public storeFrontendData = (payload: StoreFrontendDataPayload) => {
    return this.withDefaults().appendArgs(
      [ArgTypeEnum.TEXT, this.formatStoreBadge("STORE FE")],
      [ArgTypeEnum.TEXT, chalk.cyan(`session=${payload.sessionId}`)],

      [ArgTypeEnum.TEXT, `msgs=${chalk.bold(payload.totalMessages)}`],
      [ArgTypeEnum.TEXT, `rounds=${chalk.green(payload.totalRounds)}`],
      [ArgTypeEnum.TEXT, `compressed=${chalk.magenta(payload.compressedCount)}`],
    );
  };

  /** 单轮查询 */
  public storeSingleRound = (payload: StoreSingleRoundPayload) => {
    return this.withDefaults().appendArgs(
      [ArgTypeEnum.TEXT, this.formatStoreBadge("STORE ROUND")],
      [ArgTypeEnum.TEXT, chalk.cyan(`session=${payload.sessionId}`)],

      [ArgTypeEnum.TEXT, chalk.magenta(`req=${payload.requestId}`)],
      [ArgTypeEnum.TEXT, `msgs=${chalk.bold(payload.messageCount)}`],
      [ArgTypeEnum.TEXT, `tools=${payload.hasToolChain ? chalk.green("yes") : chalk.gray("no")}`],
    );
  };

  /** 压缩统计 */
  public storeCompressStats = (payload: StoreCompressStatsPayload) => {
    return this.withDefaults().appendArgs(
      [ArgTypeEnum.TEXT, this.formatStoreBadge("CTX COMPRESS")],
      [ArgTypeEnum.TEXT, chalk.cyan(`session=${payload.sessionId}`)],

      [ArgTypeEnum.TEXT, `total=${chalk.bold(payload.totalMessages)}`],
      [ArgTypeEnum.TEXT, `compressed=${chalk.magenta(payload.compressedMessages)}`],
      [ArgTypeEnum.TEXT, `saved=${chalk.green(`${payload.totalTokenSaved} tok`)}`],
      [ArgTypeEnum.TEXT, `snapshots=${chalk.blue(payload.snapshotCount)}`],
    );
  };
}
