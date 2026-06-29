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
 * ICompressStrategy — 压缩策略统一抽象接口
 *
 * 新增压缩算法无需修改核心调度代码，符合开闭原则。
 */
export interface ICompressStrategy {
  /** 执行压缩，返回压缩后内容与 Token 统计 */
  execute(rawMsg: ChatMessageEntity): { newContent: string; tokenStats: CompressTokenStats };

  /** 基于备份原文执行回滚，返回原始内容 */
  rollback(compressedMsg: ChatMessageEntity): string | null;
}

// ==================== 策略工厂 ====================

/**
 * CompressStrategyFactory — 压缩策略工厂
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

// ==================== 空桩策略实现 ====================

const NOT_IMPLEMENTED = (name: string, method: string): Error =>
  new Error(`${name}.${method} is not implemented yet.`);

/**
 * TokenPruneStrategy — 轻量级冗余字符裁剪（空桩）
 */
export class TokenPruneStrategy implements ICompressStrategy {
  execute(_rawMsg: ChatMessageEntity): { newContent: string; tokenStats: CompressTokenStats } {
    throw NOT_IMPLEMENTED("TokenPruneStrategy", "execute");
  }
  rollback(_compressedMsg: ChatMessageEntity): string | null {
    throw NOT_IMPLEMENTED("TokenPruneStrategy", "rollback");
  }
}

/**
 * RoundAbstractStrategy — 多轮对话合并语义摘要（空桩）
 */
export class RoundAbstractStrategy implements ICompressStrategy {
  execute(_rawMsg: ChatMessageEntity): { newContent: string; tokenStats: CompressTokenStats } {
    throw NOT_IMPLEMENTED("RoundAbstractStrategy", "execute");
  }
  rollback(_compressedMsg: ChatMessageEntity): string | null {
    throw NOT_IMPLEMENTED("RoundAbstractStrategy", "rollback");
  }
}

/**
 * SystemLightStrategy — 超长系统提示词轻量化精简（空桩）
 */
export class SystemLightStrategy implements ICompressStrategy {
  execute(_rawMsg: ChatMessageEntity): { newContent: string; tokenStats: CompressTokenStats } {
    throw NOT_IMPLEMENTED("SystemLightStrategy", "execute");
  }
  rollback(_compressedMsg: ChatMessageEntity): string | null {
    throw NOT_IMPLEMENTED("SystemLightStrategy", "rollback");
  }
}

/**
 * ToolMergeStrategy — 多轮工具返回结果合并压缩（空桩）
 */
export class ToolMergeStrategy implements ICompressStrategy {
  execute(_rawMsg: ChatMessageEntity): { newContent: string; tokenStats: CompressTokenStats } {
    throw NOT_IMPLEMENTED("ToolMergeStrategy", "execute");
  }
  rollback(_compressedMsg: ChatMessageEntity): string | null {
    throw NOT_IMPLEMENTED("ToolMergeStrategy", "rollback");
  }
}

/**
 * LlmSemanticSummaryStrategy — 轻量模型深度语义压缩（空桩）
 */
export class LlmSemanticSummaryStrategy implements ICompressStrategy {
  execute(_rawMsg: ChatMessageEntity): { newContent: string; tokenStats: CompressTokenStats } {
    throw NOT_IMPLEMENTED("LlmSemanticSummaryStrategy", "execute");
  }
  rollback(_compressedMsg: ChatMessageEntity): string | null {
    throw NOT_IMPLEMENTED("LlmSemanticSummaryStrategy", "rollback");
  }
}
