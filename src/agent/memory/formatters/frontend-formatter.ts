import { MessageRole } from "../constants";
import type { ChatMessageEntity } from "../mongo-repo";
import type { AiMessageTokenUsage } from "../../../models/aiSessionMessageModel";

// ==================== 类型定义 ====================

/**
 * FrontendBaseMsg — 前端基础渲染消息
 */
export interface FrontendBaseMsg {
  messageId: string;
  role: string;
  displayContent: string | null;
  /** 压缩前的原始完整内容（仅压缩消息有值） */
  rawFullContent?: string | null;
  isCompressed: boolean;
  compressInfo?: {
    ratio?: number;
    algorithm?: string | null;
  };
  isSystemPrompt: boolean;
  isLoading: boolean;
}

/**
 * FrontendChatRound — 前端单轮会话结构
 *
 * 按 requestId 分组，内部拆分用户消息、AI 工具链、最终回答
 */
export interface FrontendChatRound {
  requestId: string;
  sessionId: string;
  userMessage?: FrontendBaseMsg;
  /** AI 工具调用链（不含最终回答） */
  assistantMessages: FrontendBaseMsg[];
  /** 轮次最终回答 */
  finalMessage?: FrontendBaseMsg;
  roundTime?: Date;
  tokenUsage?: AiMessageTokenUsage;
}

// ==================== 格式化函数 ====================

/**
 * 单条数据库消息转为前端基础渲染消息
 *
 * 解析压缩标识、挂载压缩 UI 信息
 */
export function formatToFrontendMessage(entity: ChatMessageEntity): FrontendBaseMsg {
  return {
    messageId: entity.messageId,
    role: entity.role,
    displayContent: entity.content,
    rawFullContent: entity.isCompressed ? entity.originalContent : undefined,
    isCompressed: entity.isCompressed ?? false,
    compressInfo: entity.compressMeta
      ? {
          ratio: entity.compressMeta.compressionRatio,
          algorithm: entity.compressedVersion,
        }
      : undefined,
    isSystemPrompt: entity.role === MessageRole.SYSTEM,
    isLoading: false,
  };
}

/**
 * 按 requestId 分组，批量组装前端单轮会话结构
 *
 * 自动解析 tool_calls.arguments 字符串为对象，免除前端 JSON.parse；
 * 绑定 toolCallId 实现 UI 关联。
 */
export function buildFrontendChatRound(
  roundMsgList: ChatMessageEntity[],
  requestId: string,
  sessionId: string,
): FrontendChatRound {
  const sorted = [...roundMsgList].sort((a, b) => a.sortIndex - b.sortIndex);

  const userMessage = sorted.find((m) => m.role === MessageRole.USER);
  const assistantMessages: FrontendBaseMsg[] = [];
  let finalMessage: FrontendBaseMsg | undefined;

  const toolResultMap = new Map<string, ChatMessageEntity[]>();
  // 按 tool_call_id 分组 tool 消息
  for (const msg of sorted) {
    if (msg.role === MessageRole.TOOL && msg.tool_call_id) {
      const existing = toolResultMap.get(msg.tool_call_id) ?? [];
      existing.push(msg);
      toolResultMap.set(msg.tool_call_id, existing);
    }
  }

  for (const msg of sorted) {
    if (msg.role === MessageRole.ASSISTANT) {
      const frontendMsg = formatToFrontendMessage(msg);

      // 解析 tool_calls.arguments JSON 字符串为对象
      if (frontendMsg.displayContent === null && msg.tool_calls && msg.tool_calls.length > 0) {
        // 工具调用消息：将 arguments 字符串解析为对象，挂载到 displayContent
        const parsedCalls = msg.tool_calls.map((tc) => ({
          ...tc,
          function: {
            ...tc.function,
            arguments: tryParseJSON(tc.function.arguments),
          },
        }));
        frontendMsg.displayContent = JSON.stringify(parsedCalls);
        assistantMessages.push(frontendMsg);
      } else if (msg.content !== null && msg.content !== undefined) {
        // 有实际文本内容的 assistant 消息作为最终回答
        finalMessage = frontendMsg;
      } else {
        assistantMessages.push(frontendMsg);
      }
    }
  }

  // 取最早的创建时间作为轮次时间
  const roundTime = sorted[0]?.createdAt;

  // 取最后一条消息的 tokenUsage 作为轮次 token 统计
  const lastMsg = sorted[sorted.length - 1];
  const tokenUsage = lastMsg?.tokenUsage;

  return {
    requestId,
    sessionId,
    userMessage: userMessage ? formatToFrontendMessage(userMessage) : undefined,
    assistantMessages,
    finalMessage,
    roundTime,
    tokenUsage,
  };
}

/**
 * 批量将会话全部消息组装为前端轮次数组
 *
 * 按 requestId 分组，各组按最早 sortIndex 排序
 */
export function buildFrontendSessionData(
  entities: ChatMessageEntity[],
): FrontendChatRound[] {
  // 按 requestId 分组
  const roundMap = new Map<string, ChatMessageEntity[]>();
  for (const entity of entities) {
    if (!entity.requestId) continue;
    const existing = roundMap.get(entity.requestId) ?? [];
    existing.push(entity);
    roundMap.set(entity.requestId, existing);
  }

  // 每组构建 FrontendChatRound
  const rounds: FrontendChatRound[] = [];
  for (const [requestId, msgs] of roundMap) {
    const sessionId = msgs[0]?.sessionId ?? "";
    rounds.push(buildFrontendChatRound(msgs, requestId, sessionId));
  }

  // 按轮次最早消息的 sortIndex 排序
  rounds.sort((a, b) => {
    const aMin = entities.find((e) => e.requestId === a.requestId)?.sortIndex ?? 0;
    const bMin = entities.find((e) => e.requestId === b.requestId)?.sortIndex ?? 0;
    return aMin - bMin;
  });

  return rounds;
}

// ==================== 内部辅助 ====================

/**
 * 安全解析 JSON 字符串，失败时返回原始字符串
 */
function tryParseJSON(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
