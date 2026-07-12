/**
 * 简易 token 估算：字符数 / 4，向上取整（与 ConversationStore 启发式一致）
 *
 * 用于上下文压缩阶段的阈值比较与节省量统计，不追求精确 tokenizer 对等。
 */
export function estimateTokenCount(content: string | null): number {
  if (content === null || content === undefined) return 0;
  return Math.ceil(String(content).length / 4);
}
