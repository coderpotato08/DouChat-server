import { Context } from "koa";
import { v4 as uuidv4 } from "uuid";
import { getMainAgent, initMainAgent } from "../../agent/engine/main-agent";
import { bashBlacklistStore, permissionStore } from "../../agent/permission";
import { $ErrorCode, $ErrorMessage, $SuccessCode } from "../../constant/errorData";
import { getValidatedRequestData } from "../../middleware/validate-request";
import { createRes } from "../../models/responseModel";
import { createSSESession } from "../../utils/sse-utils";
import { AgentCompletionRequestBody, AgentPermissionRequestBody } from "./validator";

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
  const { body } = getValidatedRequestData<AgentCompletionRequestBody>(ctx);
  const requestId = uuidv4();

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
    .runWithSession(requestId, () =>
      agent.sendThinkingStreamMessage(body.sessionId, requestId, body.userId, body.prompt, body.modelProvider, eventHandler),
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

export const agentPermission = async (ctx: Context) => {
  const { body } = getValidatedRequestData<AgentPermissionRequestBody>(ctx);

  permissionStore.resolveDecision(body.requestId, body.allow);
  ctx.body = createRes($SuccessCode, { ok: true }, "");
};
