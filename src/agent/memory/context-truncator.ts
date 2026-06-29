import { MessageRole } from "./constants";
import type { ChatMessageEntity } from "./mongo-repo";

/**
 * ContextTruncator — 兜底上下文截断器
 *
 * 当压缩模块不可用或压缩后仍超出 Token 上限时，作为降级兜底方案：
 * - System 系统提示词永久置顶保留，绝不裁剪
 * - 强制保留配置内最新保护轮次对话
 * - 从最早历史消息依次裁剪
 *
 * Token 估算采用简易启发式：content.length / 4（近似 GPT tokenizer 比例）
 */
export class ContextTruncator {
  /**
   * 对消息列表执行 Token 截断
   *
   * @param messages 按 sortIndex 升序排列的消息列表
   * @param maxTokens Token 上限
   * @param reserveLatestRounds 最新 N 轮强制保护不裁剪，默认 3
   * @returns 截断后的消息列表（新数组，不修改原数组）
   */
  static truncate(
    messages: ChatMessageEntity[],
    maxTokens: number,
    reserveLatestRounds: number = 3,
  ): ChatMessageEntity[] {
    if (messages.length === 0) {
      return [];
    }

    // 分离 system 消息（永久保留）
    const systemMsgs = messages.filter((m) => m.role === MessageRole.SYSTEM);
    const chatMsgs = messages.filter((m) => m.role !== MessageRole.SYSTEM);

    // 计算 system 消息的 Token 占用
    const systemTokens = ContextTruncator.estimateTokens(systemMsgs);
    const availableTokens = maxTokens - systemTokens;

    if (availableTokens <= 0) {
      // 极端情况：system 消息本身就超了，只能全部保留（不裁剪 system）
      return [...systemMsgs, ...chatMsgs];
    }

    // 找出最新 N 轮 requestId（保护轮次）
    const protectedRequestIds = ContextTruncator.getLatestRequestIds(
      chatMsgs,
      reserveLatestRounds,
    );

    // 分类：受保护 vs 可裁剪
    const protectedMsgs: ChatMessageEntity[] = [];
    const trimmableMsgs: ChatMessageEntity[] = [];

    for (const msg of chatMsgs) {
      if (msg.requestId && protectedRequestIds.has(msg.requestId)) {
        protectedMsgs.push(msg);
      } else {
        trimmableMsgs.push(msg);
      }
    }

    // 计算受保护消息的 Token 占用
    const protectedTokens = ContextTruncator.estimateTokens(protectedMsgs);
    const remainingTokens = availableTokens - protectedTokens;

    if (remainingTokens <= 0) {
      // 受保护消息已占满，只保留 system + 受保护消息
      return [...systemMsgs, ...protectedMsgs];
    }

    // 从最早的可裁剪消息开始，依次保留直到达到 Token 上限
    const keptTrimmable: ChatMessageEntity[] = [];
    let usedTokens = 0;

    for (const msg of trimmableMsgs) {
      const msgTokens = ContextTruncator.estimateSingleToken(msg);
      if (usedTokens + msgTokens <= remainingTokens) {
        keptTrimmable.push(msg);
        usedTokens += msgTokens;
      } else {
        // 一旦开始裁剪，后面的全部丢弃（保持连续）
        break;
      }
    }

    // 合并并按 sortIndex 排序（system 在前）
    const result = [...systemMsgs, ...keptTrimmable, ...protectedMsgs];
    result.sort((a, b) => a.sortIndex - b.sortIndex);

    return result;
  }

  // ==================== 内部辅助 ====================

  /**
   * 估算消息列表的 Token 总数
   */
  private static estimateTokens(messages: ChatMessageEntity[]): number {
    return messages.reduce(
      (sum, m) => sum + ContextTruncator.estimateSingleToken(m),
      0,
    );
  }

  /**
   * 估算单条消息的 Token 数
   * 简易启发式：content.length / 4（近似 GPT tokenizer 比例）
   */
  private static estimateSingleToken(msg: ChatMessageEntity): number {
    const content = msg.content ?? "";
    return Math.ceil(content.length / 4);
  }

  /**
   * 获取最新的 N 个 requestId
   */
  private static getLatestRequestIds(
    messages: ChatMessageEntity[],
    n: number,
  ): Set<string> {
    const seen = new Set<string>();
    const requestIds: string[] = [];

    // 从后往前遍历（最新消息优先）
    for (let i = messages.length - 1; i >= 0; i--) {
      const requestId = messages[i].requestId;
      if (requestId && !seen.has(requestId)) {
        seen.add(requestId);
        requestIds.push(requestId);
        if (requestIds.length >= n) {
          break;
        }
      }
    }

    return new Set(requestIds);
  }
}
