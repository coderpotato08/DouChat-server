import { CompressStrategy } from "../constants";
import { CompressStrategyNotFoundError } from "../errors";
import type { ChatMessageEntity } from "../mongo-repo";

// ==================== 类型定义 ====================

/** 压缩 Token 统计 */
export interface CompressTokenStats {
  originalTokens: number;
  compressedTokens: number;
  savedTokens: number;
  ratio: number;
}

// ==================== 策略接口 ====================

/**
 * ICompressStrategy - 压缩策略统一抽象接口
 *
 * 新增压缩算法无需修改核心调度代码，符合开闭原则。
 * 注：单消息级接口保留给未来；会话级管线阶段见 pipeline/ 下的 IPipelineStage（待实现）。
 */
export interface ICompressStrategy {
  /** 执行压缩，返回压缩后内容与 Token 统计 */
  execute(rawMsg: ChatMessageEntity): { newContent: string; tokenStats: CompressTokenStats };

  /** 基于备份原文执行回滚，返回原始内容 */
  rollback(compressedMsg: ChatMessageEntity): string | null;
}

// ==================== 策略工厂 ====================

/**
 * CompressStrategyFactory - 压缩策略工厂
 *
 * 管理所有已注册的压缩策略，按名称分发。
 */
export class CompressStrategyFactory {
  private strategies: Map<CompressStrategy, ICompressStrategy> = new Map();

  /**
   * 注册一个压缩策略实现
   */
  register(name: CompressStrategy, strategy: ICompressStrategy): void {
    if (this.strategies.has(name)) {
      throw new Error(`Compress strategy already registered: ${name}`);
    }
    this.strategies.set(name, strategy);
  }

  /**
   * 获取已注册的策略，未注册时抛出 CompressStrategyNotFoundError
   */
  get(name: CompressStrategy): ICompressStrategy {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new CompressStrategyNotFoundError(name);
    }
    return strategy;
  }

  /**
   * 获取所有已注册的策略名称
   */
  listRegistered(): CompressStrategy[] {
    return Array.from(this.strategies.keys());
  }
}
