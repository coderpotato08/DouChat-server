/**
 * CircuitBreaker - 压缩熔断器（仅用于 autoCompact 等 LLM 交互场景）
 *
 * 按 session 维度累计连续失败次数：达到阈值后强制跳过该 session 后续 autoCompact，
 * 成功一次即清零计数，防止 LLM 摘要反复失败导致资源浪费。
 *
 * ⚠️ 仅 autoCompact（LLM 摘要）这类高成本、可失败的操作引入熔断；
 *    L1/L2/L3 本地管线（无 LLM、轻量可逆）不使用本熔断器。
 *
 * 典型用法（autoCompact 调用方）：
 *   if (breaker.isTripped(sessionId)) return;
 *   try {
 *     await autoCompact(...);
 *     breaker.recordSuccess(sessionId);
 *   } catch {
 *     breaker.recordFailure(sessionId);
 *   }
 *
 * 状态：内存 Map 计数，进程重启即清零，不持久化。
 * 详见 docs/plan/conversation-store-v2/compressor-pipeline-design.md 2.3。
 */
const DEFAULT_CIRCUIT_BREAKER_THRESHOLD = 3;

export class CircuitBreaker {
  private readonly threshold: number;
  private readonly failureCounts: Map<string, number> = new Map();

  constructor(threshold: number = DEFAULT_CIRCUIT_BREAKER_THRESHOLD) {
    if (!Number.isInteger(threshold) || threshold < 1) {
      throw new Error(
        `CircuitBreaker threshold must be a positive integer, got: ${threshold}`,
      );
    }
    this.threshold = threshold;
  }

  /** 是否已熔断（发起 autoCompact 前检查，命中则跳过） */
  isTripped(sessionId: string): boolean {
    return (this.failureCounts.get(sessionId) ?? 0) >= this.threshold;
  }

  /** 记录一次成功，清零该 session 计数 */
  recordSuccess(sessionId: string): void {
    this.failureCounts.delete(sessionId);
  }

  /** 记录一次失败并累加计数；返回是否因本次失败而触发熔断 */
  recordFailure(sessionId: string): boolean {
    const next = (this.failureCounts.get(sessionId) ?? 0) + 1;
    this.failureCounts.set(sessionId, next);
    return next >= this.threshold;
  }
}
