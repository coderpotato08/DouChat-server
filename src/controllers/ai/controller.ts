import { Context } from "koa";
import { v4 as uuidv4 } from "uuid";
import { getMainAgent, initMainAgent } from "../../agent/engine/main-agent";
import { IdGenerator } from "../../agent/memory/id-generator";
import { bashBlacklistStore, permissionStore } from "../../agent/permission";
import { $ErrorCode, $ErrorMessage, $SuccessCode } from "../../constant/errorData";
import { getValidatedRequestData } from "../../middleware/validate-request";
import AiSessionModel from "../../models/aiSessionModel";
import AiSessionMessageModel from "../../models/aiSessionMessageModel";
import { createRes } from "../../models/responseModel";
import { createSSESession } from "../../utils/sse-utils";
import {
  AgentCompletionRequestBody,
  AgentPermissionRequestBody,
  GetSessionRequestBody,
  InitSessionRequestBody,
} from "./validator";

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

/**
 * 获取指定会话的全部消息
 * POST /ai/session/get
 */
export const getSession = async (ctx: Context) => {
  const { body } = getValidatedRequestData<GetSessionRequestBody>(ctx);

  // 1. 校验会话是否存在且属于该用户
  const session = await AiSessionModel.findOne({
    sessionId: body.sessionId,
    isDeleted: false,
  }).lean();

  if (!session) {
    ctx.body = createRes(
      $ErrorCode.Common.SERVER_ERROR,
      null,
      "会话不存在或已被删除",
    );
    return;
  }

  if (session.userId !== body.userId) {
    ctx.body = createRes(
      $ErrorCode.Common.SERVER_ERROR,
      null,
      "无权访问该会话",
    );
    return;
  }

  // 2. 查询会话下全部消息，按 sortIndex 升序
  const messages = await AiSessionMessageModel.find({
    sessionId: body.sessionId,
  })
    .sort({ sortIndex: 1 })
    .lean();

  ctx.body = createRes(
    $SuccessCode,
    {
      session: {
        sessionId: session.sessionId,
        title: session.title,
        status: session.status,
        modelProvider: session.modelProvider,
        messageCount: session.messageCount,
        lastMessagePreview: session.lastMessagePreview,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      messages,
    },
    "",
  );
};

/**
 * 新建会话
 * POST /ai/session/init
 */
export const initSession = async (ctx: Context) => {
  const { body } = getValidatedRequestData<InitSessionRequestBody>(ctx);

  const sessionId = IdGenerator.generate("session");

  await AiSessionModel.create({
    sessionId,
    userId: body.userId,
    title: "新对话",
    status: "active",
    modelProvider: body.modelProvider,
    messageCount: 0,
    lastMessagePreview: "",
    isDeleted: false,
    deletedAt: null,
  });

  ctx.body = createRes(
    $SuccessCode,
    { sessionId },
    "",
  );
};
