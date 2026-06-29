import { MessageRole } from "../constants";
import type { ChatMessageEntity } from "../mongo-repo";
import type { AiToolFunctionCall } from "../../../models/aiSessionMessageModel";

// ==================== 类型定义 ====================

/**
 * RawLLMMessage — LLM 标准消息结构
 *
 * 仅包含 LLM API 需要的原生字段，剔除数据库扩展字段。
 */
export interface RawLLMMessage {
  role: string;
  content: string | null;
  tool_calls?: AiToolFunctionCall[];
  tool_call_id?: string;
}

// ==================== 格式化函数 ====================

/**
 * 数据库消息实体转为 LLM 标准消息结构
 *
 * 内容优先级：开启压缩取压缩 content，关闭则读取原始备份 originalContent
 *
 * @param entity 数据库 ChatMessageEntity
 * @param useCompressed 是否使用压缩后内容
 * @returns LLM 原生 message 对象
 */
export function formatToLLMMessage(
  entity: ChatMessageEntity,
  useCompressed: boolean,
): RawLLMMessage {
  const finalContent =
    useCompressed && entity.isCompressed
      ? entity.content
      : (entity.originalContent ?? entity.content);

  return {
    role: entity.role,
    content: finalContent,
    ...(entity.tool_calls && { tool_calls: entity.tool_calls }),
    ...(entity.tool_call_id && { tool_call_id: entity.tool_call_id }),
  };
}

/**
 * 批量转换整组消息为 LLM 上下文数组
 *
 * 按时序（sortIndex）排序，System 消息置顶
 *
 * @param entities 数据库消息实体列表
 * @param useCompressed 是否使用压缩后内容
 * @returns LLM 标准消息数组
 */
export function batchFormatToLLMContext(
  entities: ChatMessageEntity[],
  useCompressed: boolean,
): RawLLMMessage[] {
  const sorted = [...entities].sort((a, b) => a.sortIndex - b.sortIndex);

  // System 消息置顶
  const systemMsgs = sorted.filter((e) => e.role === MessageRole.SYSTEM);
  const chatMsgs = sorted.filter((e) => e.role !== MessageRole.SYSTEM);

  return [...systemMsgs, ...chatMsgs].map((item) =>
    formatToLLMMessage(item, useCompressed),
  );
}
