import { Context } from "koa";
import type OpenAI from "openai";
import { getMainAgent, initMainAgent } from "../../agent/engine/main-agent";
import { IdGenerator } from "../../agent/memory/id-generator";
import { bashBlacklistStore, permissionStore } from "../../agent/permission";
import { FINAL_MESSAGE } from "../../agent/types/agent";
import { $ErrorCode, $ErrorMessage, $SuccessCode } from "../../constant/errorData";
import { getValidatedRequestData } from "../../middleware/validate-request";
import AiSessionMessageModel from "../../models/aiSessionMessageModel";
import AiSessionModel from "../../models/aiSessionModel";
import { createRes } from "../../models/responseModel";
import { stripThinkingTags } from "../../utils/common-utils";
import { createSSESession, writeSSEData, type SSESession } from "../../utils/sse-utils";
import {
  AgentCompletionRequestBody,
  AgentPermissionRequestBody,
  GetSessionListRequestBody,
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

  if (body.debug) {
    void runMockAgentMessageStream(sseSession);
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
    .runWithSession(body.requestId, () =>
      agent.sendThinkingStreamMessage(
        body.sessionId,
        body.requestId,
        body.userId,
        body.prompt,
        body.modelProvider,
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

export const agentPermission = async (ctx: Context) => {
  const { body } = getValidatedRequestData<AgentPermissionRequestBody>(ctx);

  permissionStore.resolveDecision(body.requestId, body.allow);
  ctx.body = createRes($SuccessCode, { ok: true }, "");
};

/**
 * 测试接口
 * mock agent消息输出，将mock/mock-messages.ts内容通过SSE流式输出，用于前端调试
 * 输出格式和真实sendThinkingStreamMessage一致
 */
type MockToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

const runMockAgentMessageStream = async (sseSession: SSESession): Promise<void> => {
  const loadMockMessages = (): OpenAI.Chat.Completions.ChatCompletionMessageParam[] => {
    const mockPath = require("node:path").join(process.cwd(), "mock", "mock-messages.ts");
    const mod = require(mockPath) as {
      mockMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    };
    return mod.mockMessages;
  };

  const getTextContent = (
    content: OpenAI.Chat.Completions.ChatCompletionMessageParam["content"],
  ): string | null => {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return null;

    const text = content.map((part) => (part.type === "text" ? part.text : "")).join("");
    return text || null;
  };

  // 逐字流式输出内容，模拟真实打字效果（只输出 content_delta；content_start/content_done 由外层统一发送）
  const streamContent = async (content: string | null, delayPerChar = 30) => {
    if (!content || sseSession.isClosed()) return;
    for (let i = 0; i < content.length; i++) {
      if (sseSession.isClosed()) return;
      writeSSEData(
        sseSession.stream,
        JSON.stringify({
          type: "content_delta",
          delta: content[i],
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, delayPerChar));
    }
  };

  // 输出工具调用开始事件（对齐 onToolUseStart）
  const streamToolUseStart = async (toolCall: MockToolCall) => {
    if (sseSession.isClosed()) return;
    writeSSEData(
      sseSession.stream,
      JSON.stringify({
        type: "tool_use_start",
        toolName: toolCall.function.name,
        toolUseId: toolCall.id,
        data: JSON.parse(toolCall.function.arguments),
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 800)); // 模拟工具执行前置延迟
  };

  // 输出工具调用结束和结果（对齐 onToolUseDone）
  const streamToolUseDone = async (toolName: string, toolUseId: string, resultContent: string) => {
    if (sseSession.isClosed()) return;
    const data = JSON.parse(resultContent);
    writeSSEData(
      sseSession.stream,
      JSON.stringify({
        type: "tool_use_done",
        toolName,
        toolUseId,
        success: true,
        data,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
  };

  try {
    // 1. 输出开始事件，模拟真实 sendThinkingStreamMessage：content_start 只发一次
    writeSSEData(sseSession.stream, JSON.stringify({ type: "thinking_start" }));
    writeSSEData(sseSession.stream, JSON.stringify({ type: "content_start" }));
    await new Promise((resolve) => setTimeout(resolve, 1000));

    let pendingToolCall: MockToolCall | null = null;
    let finalContent: string | null = null;
    const mockMessages = loadMockMessages();

    // 2. 遍历mock消息：工具链按真实流程输出；assistant文本只保留最后一条作为末轮流式回答
    for (const msg of mockMessages) {
      if (sseSession.isClosed()) break;

      switch (msg.role) {
        case "system":
        case "user":
          // 系统提示和用户消息不输出给前端（前端已持有）
          continue;

        case "assistant":
          if (msg.tool_calls && msg.tool_calls.length > 0) {
            // 工具调用消息：输出工具调用开始事件
            for (const toolCall of msg.tool_calls) {
              if (toolCall.type === "function") {
                pendingToolCall = toolCall as MockToolCall;
                await streamToolUseStart(pendingToolCall);
              }
            }
          } else {
            // 真实 sendThinkingStreamMessage 的非末轮 assistant 文本不会流给前端；
            // 这里只缓存最后一条 assistant 文本，等全部工具调用结束后统一按 content_delta 流式输出。
            finalContent = getTextContent(msg.content) ?? finalContent;
          }
          break;

        case "tool":
          // 工具结果消息：和之前 pending 的 toolCall 对应，输出工具执行完成事件
          if (pendingToolCall && msg.tool_call_id === pendingToolCall.id) {
            const textContent = getTextContent(msg.content);
            if (textContent) {
              await streamToolUseDone(pendingToolCall.function.name, msg.tool_call_id, textContent);
            }
            pendingToolCall = null;
          }
          break;
      }
    }

    // 3. 全部工具事件结束后，再模拟末轮真实流式回答
    if (finalContent && !sseSession.isClosed()) {
      await streamContent(finalContent);
    }

    // 4. 输出结束事件：content_done 后不再发送任何业务内容，仅 close() 写 [DONE]
    if (!sseSession.isClosed()) {
      writeSSEData(sseSession.stream, JSON.stringify({ type: "content_done" }));
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // 4. 发送结束标记并关闭连接
    sseSession.close();
  } catch (error) {
    console.error("mock SSE 输出错误:", error);
    if (!sseSession.isClosed()) {
      sseSession.sendError(error instanceof Error ? error.message : "未知错误");
      sseSession.close();
    }
  }
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

  const sessions = await AiSessionModel.find(filter).sort({ updatedAt: -1 }).lean();

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
    ctx.body = createRes($ErrorCode.Common.SERVER_ERROR, null, "会话不存在或已被删除");
    return;
  }

  if (session.userId !== body.userId) {
    ctx.body = createRes($ErrorCode.Common.SERVER_ERROR, null, "无权访问该会话");
    return;
  }

  // 2. 查询会话消息：DB 层排除 system（系统提示词）和 tool（工具结果）
  const rawMessages = await AiSessionMessageModel.find({
    sessionId: body.sessionId,
    role: { $nin: ["system"] },
  })
    .sort({ sortIndex: 1 })
    .lean();

  // 3. 结果过滤：剔除不应展示给用户的内部过程消息，避免前端出现空气泡
  //    - 最大轮次中止时注入的 user 提示（FINAL_MESSAGE）
  //    - 剥离 <think> 后内容为空的 assistant（纯思考过程）
  const messages = rawMessages
    .map((msg) => ({ ...msg, content: stripThinkingTags(msg.content) }))
    .filter((msg) => {
      const isToolCall = msg.tool_call_id || (msg.tool_calls || []).length > 0;
      if (isToolCall) {
        return true;
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

  ctx.body = createRes($SuccessCode, { sessionId }, "");
};