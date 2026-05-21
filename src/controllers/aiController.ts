import { Context } from "koa";
import { getMainAgent, initMainAgent } from "../agent/engine/main-agent";
import { $ErrorCode, $ErrorMessage, $SuccessCode } from "../constant/errorData";
import { createRes } from "../models/responseModel";
import { createSSESession } from "../utils/sse-utils";

type AgentCompletionBody = {
  prompt?: unknown;
  userId?: unknown;
};

const parseAgentCompletionBody = (ctx: Context) => {
  const { prompt, userId } = (ctx.request.body || {}) as AgentCompletionBody;

  if (typeof prompt !== "string" || typeof userId !== "string") {
    return null;
  }

  const trimmedPrompt = prompt.trim();
  const trimmedUserId = userId.trim();

  if (!trimmedPrompt || !trimmedUserId) {
    return null;
  }

  return {
    prompt: trimmedPrompt,
    userId: trimmedUserId,
  };
};

export const initAgent = async (ctx: Context) => {
  try {
    await initMainAgent();
    ctx.body = createRes(
      $SuccessCode,
      {
        success: true,
      },
      ""
    );
  } catch (error) {
    console.error("❗️主Agent初始化失败:", error);
    ctx.body = createRes(
      $ErrorCode.Agent.AGENT_INIT_FAILURE,
      {
        success: false,
      },
      $ErrorMessage.Common.SERVER_ERROR
    );
  }
};

export const agentCompletion = async (ctx: Context) => {
  const sseSession = createSSESession(ctx);
  const requestBody = parseAgentCompletionBody(ctx);

  if (!requestBody) {
    sseSession.sendError("prompt和userId不能为空");
    sseSession.close();
    return;
  }

  let agent;
  try {
    agent = getMainAgent();
  } catch (error) {
    console.error("❗️主Agent尚未初始化:", error);
    sseSession.sendError("MainAgent has not been initialized. Please call initMainAgent() first.");
    sseSession.close();
    return;
  }

  const eventHandler = agent.createHttpStreamHandler((chunk) => {
    if (sseSession.isClosed()) {
      return;
    }
    sseSession.stream.write(chunk);
  });

  void agent
    .sendThinkingStreamMessage(requestBody.userId, requestBody.prompt, eventHandler)
    .then(() => {
      sseSession.close();
    })
    .catch((error) => {
      console.error("Agent处理消息时发生错误:", error);
      sseSession.sendError(
        error instanceof Error && error.message ? error.message : $ErrorMessage.Common.SERVER_ERROR
      );
      sseSession.close();
    });
};
