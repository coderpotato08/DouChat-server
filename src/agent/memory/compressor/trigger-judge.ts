import type { StoreGlobalConfig } from "../constants";
import { CompressTriggerMode } from "../constants";
import type { MongoConversationRepo } from "../mongo-repo";

/**
 * CompressTriggerJudge — 压缩触发判定器（空桩）
 *
 * 三类触发逻辑（自动 Token 阈值 / 闲置超时 / 手动强制），
 * 当前为桩实现，始终返回不触发。
 */
export class CompressTriggerJudge {
  private config: StoreGlobalConfig["compress"];
  private repo: MongoConversationRepo;

  constructor(config: StoreGlobalConfig["compress"], repo: MongoConversationRepo) {
    this.config = config;
    this.repo = repo;
  }

  /**
   * 判断是否应对指定会话触发压缩
   * 当前桩实现：始终返回不触发
   */
  async shouldCompress(
    _sessionId: string,
  ): Promise<{ should: boolean; mode: CompressTriggerMode | null }> {
    // 桩实现：压缩模块尚未实现，始终返回不触发
    return { should: false, mode: null };
  }

  /**
   * 检查自动压缩是否已启用
   */
  isAutoCompressEnabled(): boolean {
    return this.config.enableAutoCompress;
  }
}
