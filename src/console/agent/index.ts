import chalk from "chalk";
import {
  AgentResponsePayload,
  AgentRoundPayload,
  AgentSessionDonePayload,
  AgentSessionErrorPayload,
  AgentSessionStartPayload,
  AgentToolDonePayload,
  AgentToolStartPayload,
} from "./type";
import BaseLog, { ArgTypeEnum, ConsoleArg } from "../base";

const previewText = (value: unknown, maxLength = 120): string => {
  if (value === undefined || value === null) {
    return "";
  }

  const raw = typeof value === "string" ? value : JSON.stringify(value);
  const normalized = raw.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
};

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return previewText(error, 160) || "Unknown error";
};

/**
 * Agent 领域日志实现：会话开始、轮次、工具、结束和异常节点
 * 都统一封装在同一个日志类中，直接作为 console 扩展使用。
 */
export default class AgentLog extends BaseLog {
  constructor(consoleArgs: ConsoleArg[] = []) {
    super(consoleArgs);
  }

  public sessionStart = (payload: AgentSessionStartPayload) => {
    return this.appendArgs(
      [ArgTypeEnum.TEXT, chalk.bgBlackBright.white.bold(" AGENT ")],
      [ArgTypeEnum.TEXT, chalk.cyan.bold(payload.sessionId)],
      [ArgTypeEnum.TEXT, `user=${chalk.green.bold(payload.userId)}`],
      [ArgTypeEnum.TEXT, payload.model ? `model=${chalk.yellow.bold(payload.model)}` : ""],
      [ArgTypeEnum.TEXT, chalk.gray(previewText(payload.message, 100) || "empty prompt")]
    );
  };

  public roundStart = (payload: AgentRoundPayload) => {
    return this.appendArgs(
      [ArgTypeEnum.TEXT, chalk.cyan.bold(`[ROUND ${payload.round}]`)],
      [ArgTypeEnum.TEXT, `messages=${chalk.green.bold(payload.messageCount)}`],
      [ArgTypeEnum.TEXT, chalk.gray("requesting model response")]
    );
  };

  public llmResponse = (payload: AgentResponsePayload) => {
    const preview = previewText(payload.contentPreview);
    return this.appendArgs(
      [ArgTypeEnum.TEXT, chalk.magenta.bold(`[LLM ${payload.round}]`)],
      [ArgTypeEnum.TEXT, `finish=${chalk.yellow.bold(payload.finishReason || "unknown")}`],
      [ArgTypeEnum.TEXT, `tools=${chalk.green.bold(payload.toolCallCount)}`],
      [ArgTypeEnum.TEXT, preview ? chalk.gray(preview) : chalk.gray("empty response")]
    );
  };

  public toolStart = (payload: AgentToolStartPayload) => {
    const inputPreview = previewText(payload.input);
    return this.appendArgs(
      [ArgTypeEnum.TEXT, chalk.blue.bold(`[TOOL ${payload.round}]`)],
      [ArgTypeEnum.TEXT, chalk.green.bold(payload.toolName)],
      [ArgTypeEnum.TEXT, payload.toolCallId ? chalk.gray(`#${payload.toolCallId}`) : ""],
      [ArgTypeEnum.TEXT, inputPreview ? chalk.gray(`input=${inputPreview}`) : chalk.gray("input=empty")]
    );
  };

  public toolDone = (payload: AgentToolDonePayload) => {
    const resultPreview = previewText(payload.success ? payload.output : payload.error);
    return this.appendArgs(
      [ArgTypeEnum.TEXT, chalk.blue.bold(`[TOOL ${payload.round}]`)],
      [ArgTypeEnum.TEXT, chalk.green.bold(payload.toolName)],
      [ArgTypeEnum.TEXT, payload.toolCallId ? chalk.gray(`#${payload.toolCallId}`) : ""],
      [ArgTypeEnum.TEXT, `${chalk.cyan.bold(`${payload.executionTime}ms`)}`],
      [ArgTypeEnum.TEXT, resultPreview ? chalk.gray(resultPreview) : chalk.gray("no output")]
    );
  };

  public sessionDone = (payload: AgentSessionDonePayload) => {
    const suffix = payload.reachedMaxRounds ? "max rounds reached" : payload.finishReason || "stop";
    return this.appendArgs(
      [ArgTypeEnum.TEXT, chalk.green.bold("[SESSION DONE]")],
      [ArgTypeEnum.TEXT, `rounds=${chalk.green.bold(payload.roundsCompleted)}`],
      [ArgTypeEnum.TEXT, chalk.gray(suffix)]
    );
  };

  public sessionError = (payload: AgentSessionErrorPayload) => {
    return this.appendArgs(
      [ArgTypeEnum.TEXT, chalk.red.bold(`[SESSION ERROR ${payload.round}]`)],
      [ArgTypeEnum.TEXT, chalk.gray(formatError(payload.error))]
    );
  };
}
