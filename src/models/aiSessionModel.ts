import { Schema, model } from "mongoose";

// ==================== 常量定义 ====================

/** 会话状态 */
export const AI_SESSION_STATUSES = ["active", "archived", "deleted"] as const;
export type AiSessionStatus = (typeof AI_SESSION_STATUSES)[number];

// ==================== 文档接口 ====================

/** AiSession 文档 — 会话主表，聚合多次 AiSessionMessage 为一个完整对话 */
export interface AiSessionDocument {
  /** 会话唯一标识（UUIDv7），与 AiSessionMessage.sessionId 关联 */
  sessionId: string;
  /** 会话所属用户 ID */
  userId: string;
  /** 会话标题（AI 生成，截取首条 prompt 摘要） */
  title: string;
  /** 会话状态：active=活跃, archived=归档, deleted=软删除 */
  status: AiSessionStatus;
  /** 使用的模型提供商 */
  modelProvider: string;
  /** 消息总数（冗余计数，避免 count 查询） */
  messageCount: number;
  /** 最后一条消息预览（前端列表展示用） */
  lastMessagePreview: string;
  /** 软删除时间（status 为 deleted 时记录） */
  deletedAt: Date | null;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

// ==================== Schema 定义 ====================

const AiSessionSchema = new Schema<AiSessionDocument>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    userId: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },
    status: {
      type: String,
      enum: AI_SESSION_STATUSES,
      default: "active",
    },
    modelProvider: {
      type: String,
      required: true,
      trim: true,
    },
    messageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastMessagePreview: {
      type: String,
      default: "",
      maxlength: 200,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "ai_sessions",
    timestamps: true,
    versionKey: false,
  },
);

// ==================== 索引 ====================

// 按 sessionId 精确查找
AiSessionSchema.index({ sessionId: 1 }, { unique: true });

// 按用户查询会话列表（按状态过滤，按更新时间倒序）
AiSessionSchema.index({ userId: 1, status: 1, updatedAt: -1 });

// ==================== 导出 ====================

export default model<AiSessionDocument>("AiSession", AiSessionSchema);
