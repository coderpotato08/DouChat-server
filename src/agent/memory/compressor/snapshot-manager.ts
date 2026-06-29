import type { MongoConversationRepo, CompressSnapshotEntity } from "../mongo-repo";
import { CompressTriggerMode } from "../constants";

/**
 * CompressSnapshotManager — 快照与回滚管理器（空桩）
 *
 * 压缩前置自动备份原始内容，支持单消息回滚、整会话批量回滚、指定快照版本回滚。
 * 当前为桩实现，所有方法抛 "not implemented"。
 */
export class CompressSnapshotManager {
  private repo: MongoConversationRepo;

  constructor(repo: MongoConversationRepo) {
    this.repo = repo;
  }

  /**
   * 创建压缩前置快照（空桩）
   */
  async createSnapshot(
    _sessionId: string,
    _triggerMode: CompressTriggerMode,
    _strategy: string,
    _coveredRequestIds: string[],
    _fullCompressedContext: string,
    _totalSaveToken: number,
  ): Promise<CompressSnapshotEntity> {
    throw new Error("CompressSnapshotManager.createSnapshot is not implemented yet.");
  }

  /**
   * 回滚到最新快照（空桩）
   */
  async rollbackToSnapshot(_sessionId: string): Promise<boolean> {
    throw new Error("CompressSnapshotManager.rollbackToSnapshot is not implemented yet.");
  }

  /**
   * 获取会话全部快照
   */
  async getSnapshots(sessionId: string): Promise<CompressSnapshotEntity[]> {
    return this.repo.getSessionSnapshots(sessionId);
  }
}
