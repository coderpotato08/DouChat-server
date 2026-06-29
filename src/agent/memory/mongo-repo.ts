import AiSessionMessageModel from "../../models/aiSessionMessageModel";
import AiSessionCompressSnapshotModel from "../../models/aiSessionCompressSnapshotModel";
import type { AiSessionMessageDocument } from "../../models/aiSessionMessageModel";
import type { AiSessionCompressSnapshotDocument } from "../../models/aiSessionCompressSnapshotModel";
import { IdGenerator } from "./id-generator";
import { SessionNotFoundError } from "./errors";

// ==================== 类型别名 ====================

/** 数据库消息实体类型（对齐 ai_chat_messages 集合） */
export type ChatMessageEntity = AiSessionMessageDocument;

/** 压缩快照实体类型（对齐 ai_chat_compress_snapshots 集合） */
export type CompressSnapshotEntity = AiSessionCompressSnapshotDocument;

// ==================== 仓储类 ====================

/**
 * MongoConversationRepo — MongoDB 仓储抽象层
 *
 * 封装 MongoDB 全部 CRUD 操作，上层业务无感知底层存储细节。
 */
export class MongoConversationRepo {
  // ==================== 消息写入 ====================

  /**
   * 插入单条会话消息
   * 自动生成 messageId（UUIDv7）和 sortIndex（当前会话最大 + 1）
   */
  async insertSingleMessage(
    entity: Omit<ChatMessageEntity, "messageId" | "sortIndex">,
  ): Promise<ChatMessageEntity> {
    const messageId = IdGenerator.generate("message");
    const maxSortIndex = await this.getMaxSortIndex(entity.sessionId);
    const sortIndex = maxSortIndex + 1;

    const doc = new AiSessionMessageModel({
      ...entity,
      messageId,
      sortIndex,
    });

    await doc.save();
    return doc.toObject() as ChatMessageEntity;
  }

  // ==================== 消息查询 ====================

  /**
   * 获取会话全量消息，按 sortIndex 升序排列
   */
  async getSessionAllMessages(sessionId: string): Promise<ChatMessageEntity[]> {
    const docs = await AiSessionMessageModel.find({ sessionId })
      .sort({ sortIndex: 1 })
      .lean();
    return docs as ChatMessageEntity[];
  }

  /**
   * 获取单轮交互完整消息链（同一 requestId）
   */
  async getSingleRoundMessages(
    sessionId: string,
    requestId: string,
  ): Promise<ChatMessageEntity[]> {
    const docs = await AiSessionMessageModel.find({ sessionId, requestId })
      .sort({ sortIndex: 1 })
      .lean();
    return docs as ChatMessageEntity[];
  }

  // ==================== 消息更新 ====================

  /**
   * 更新压缩后的消息字段（content、isCompressed、compressMeta 等）
   */
  async updateCompressedMessage(
    messageId: string,
    compressData: Partial<ChatMessageEntity>,
  ): Promise<void> {
    const result = await AiSessionMessageModel.updateOne(
      { messageId },
      { $set: compressData },
    );
    if (result.matchedCount === 0) {
      throw new SessionNotFoundError(messageId);
    }
  }

  // ==================== 压缩快照 ====================

  /**
   * 创建压缩归档快照
   */
  async createCompressSnapshot(snapshot: CompressSnapshotEntity): Promise<void> {
    const doc = new AiSessionCompressSnapshotModel(snapshot);
    await doc.save();
  }

  /**
   * 获取会话的全部压缩快照，按创建时间倒序
   */
  async getSessionSnapshots(sessionId: string): Promise<CompressSnapshotEntity[]> {
    const docs = await AiSessionCompressSnapshotModel.find({ sessionId })
      .sort({ createTime: -1 })
      .lean();
    return docs as CompressSnapshotEntity[];
  }

  // ==================== Token 统计 ====================

  /**
   * 统计会话总 Token 消耗
   * 遍历会话全量消息，累加 tokenUsage.totalToken
   */
  async calcSessionTotalToken(sessionId: string): Promise<number> {
    const result = await AiSessionMessageModel.aggregate([
      { $match: { sessionId } },
      {
        $group: {
          _id: null,
          totalToken: { $sum: "$tokenUsage.totalToken" },
        },
      },
    ]);

    if (result.length === 0) {
      return 0;
    }
    return result[0].totalToken ?? 0;
  }

  // ==================== 会话生命周期 ====================

  /**
   * 清空会话全部消息
   */
  async clearSession(sessionId: string): Promise<boolean> {
    const result = await AiSessionMessageModel.deleteMany({ sessionId });
    return result.deletedCount > 0;
  }

  /**
   * 检查会话是否存在（至少有一条消息）
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    const count = await AiSessionMessageModel.countDocuments({ sessionId });
    return count > 0;
  }

  // ==================== 统计查询 ====================

  /**
   * 获取会话中已压缩的消息数量
   */
  async countCompressedMessages(sessionId: string): Promise<number> {
    return AiSessionMessageModel.countDocuments({ sessionId, isCompressed: true });
  }

  /**
   * 获取会话消息总数
   */
  async countMessages(sessionId: string): Promise<number> {
    return AiSessionMessageModel.countDocuments({ sessionId });
  }

  // ==================== 内部辅助 ====================

  /**
   * 获取当前会话最大 sortIndex，无消息时返回 -1
   */
  private async getMaxSortIndex(sessionId: string): Promise<number> {
    const doc = await AiSessionMessageModel.findOne({ sessionId })
      .sort({ sortIndex: -1 })
      .select("sortIndex")
      .lean();

    return doc?.sortIndex ?? -1;
  }
}
