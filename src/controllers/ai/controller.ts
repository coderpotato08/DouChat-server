import { Context } from "koa";
import { v4 as uuidv4 } from "uuid";
import { getMainAgent, initMainAgent } from "../../agent/engine/main-agent";
import { IdGenerator } from "../../agent/memory/id-generator";
import { bashBlacklistStore, permissionStore } from "../../agent/permission";
import { FINAL_MESSAGE } from "../../agent/types/agent";
import { $ErrorCode, $ErrorMessage, $SuccessCode } from "../../constant/errorData";
import { getValidatedRequestData } from "../../middleware/validate-request";
import AiSessionModel from "../../models/aiSessionModel";
import AiSessionMessageModel from "../../models/aiSessionMessageModel";
import { createRes } from "../../models/responseModel";
import { createSSESession } from "../../utils/sse-utils";
import {
  AgentCompletionRequestBody,
  AgentPermissionRequestBody,
  GetSessionListRequestBody,
  GetSessionRequestBody,
  InitSessionRequestBody,
} from "./validator";
import { stripThinkingTags } from "../../utils/common-utils";

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
 * 获取某个用户所属的所有会话列表
 * POST /ai/session/list
 */
export const getSessionList = async (ctx: Context) => {
  const { body } = getValidatedRequestData<GetSessionListRequestBody>(ctx);

  // status 不传时默认排除软删除；传单值精确匹配，传数组用 $in
  const filter: Record<string, unknown> = { userId: body.userId };
  if (body.status === undefined) {
    filter.status = { $eq: "active" };
  } else if (Array.isArray(body.status)) {
    filter.status = { $in: body.status };
  } else {
    filter.status = body.status;
  }

  const sessions = await AiSessionModel.find(filter)
    .sort({ updatedAt: -1 })
    .lean();

  ctx.body = createRes(
    $SuccessCode,
    {
      sessions,
    },
    "",
  );
};

/**
 * 获取指定会话的全部消息
 * POST /ai/session/get
 */
export const getSession = async (ctx: Context) => {
  const { body } = getValidatedRequestData<GetSessionRequestBody>(ctx);

  // 1. 校验会话是否存在且属于该用户（排除软删除）
  const session = await AiSessionModel.findOne({
    sessionId: body.sessionId,
    status: { $ne: "deleted" },
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

  // 2. 查询会话消息：DB 层排除 system（系统提示词）和 tool（工具结果）
  const rawMessages = await AiSessionMessageModel.find({
    sessionId: body.sessionId,
    role: { $nin: ["system", "tool"] },
  })
    .sort({ sortIndex: 1 })
    .lean();

  // 3. 结果过滤：剔除不应展示给用户的内部过程消息，避免前端出现空气泡
  //    - 纯 tool_calls 的 assistant（无展示文本）
  //    - 最大轮次中止时注入的 user 提示（FINAL_MESSAGE）
  //    - 剥离 <think> 后内容为空的 assistant（纯思考过程）
  const messages = rawMessages
    .map((msg) => ({ ...msg, content: stripThinkingTags(msg.content) }))
    .filter((msg) => {
      if (
        msg.role === "assistant" &&
        Array.isArray(msg.tool_calls) &&
        msg.tool_calls.length > 0 &&
        !msg.content
      ) {
        return false;
      }
      if (msg.role === "user" && msg.content === FINAL_MESSAGE) {
        return false;
      }
      if (msg.role === "assistant" && !msg.content) {
        return false;
      }
      return true;
    });

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
    deletedAt: null,
  });

  ctx.body = createRes(
    $SuccessCode,
    { sessionId },
    "",
  );
};