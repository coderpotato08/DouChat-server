import { Context } from "koa";
import { v4 as uuidv4 } from "uuid";
import { getMainAgent, initMainAgent } from "../agent/engine/main-agent";
import { bashBlacklistStore, permissionStore } from "../agent/permission";
import { $ErrorCode, $ErrorMessage, $SuccessCode } from "../constant/errorData";
import { createRes } from "../models/responseModel";
import { createSSESession } from "../utils/sse-utils";

type AgentCompletionBody = {
  prompt?: unknown;
  userId?: unknown;
  requestId?: unknown;
};

const parseAgentCompletionBody = (ctx: Context) => {
  const { prompt, userId, requestId } = (ctx.request.body || {}) as AgentCompletionBody;

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
    requestId: typeof requestId === "string" && requestId.trim() ? requestId.trim() : uuidv4(),
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
      "",
    );
  } catch (error) {
    console.error("❗️主Agent初始化失败:", error);
    ctx.body = createRes(
      $ErrorCode.Agent.AGENT_INIT_FAILURE,
      {
        success: false,
      },
      $ErrorMessage.Common.SERVER_ERROR,
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

  let agent: ReturnType<typeof getMainAgent>;
  try {
    agent = getMainAgent();
  } catch (error: any) {
    console.error("❗️主Agent尚未初始化:", error.message);
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

  void bashBlacklistStore
    .runWithSession(requestBody.requestId, () =>
      agent.sendThinkingStreamMessage(
        requestBody.requestId,
        requestBody.userId,
        requestBody.prompt,
        eventHandler,
      ),
    )
    .then(() => {
      sseSession.close();
    })
    .catch((error: unknown) => {
      console.error("Agent处理消息时发生错误:", error);
      sseSession.sendError(
        error instanceof Error && error.message ? error.message : $ErrorMessage.Common.SERVER_ERROR,
      );
      sseSession.close();
    });
};

type AgentPermissionBody = {
  requestId?: unknown;
  allow?: unknown;
};

export const agentPermission = async (ctx: Context) => {
  const { requestId, allow } = (ctx.request.body || {}) as AgentPermissionBody;

  if (typeof requestId !== "string" || !requestId.trim()) {
    ctx.status = 400;
    ctx.body = createRes($ErrorCode.Common.SERVER_ERROR, {}, "requestId 不能为空");
    return;
  }

  if (typeof allow !== "boolean") {
    ctx.status = 400;
    ctx.body = createRes($ErrorCode.Common.SERVER_ERROR, {}, "allow 必须为 boolean");
    return;
  }

  permissionStore.resolveDecision(requestId.trim(), allow);
  ctx.body = createRes($SuccessCode, { ok: true }, "");
};
