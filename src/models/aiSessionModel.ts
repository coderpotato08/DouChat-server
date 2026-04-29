import { Schema, model } from "mongoose";

export enum AiSessionStatus {
  ACTIVE = "active",
  ARCHIVED = "archived",
  DELETED = "deleted",
}

export enum AiSessionType {
  NORMAL = "normal",
  ASSISTANT = "assistant",
  AGENT = "agent",
}

export interface AiSessionDocument {
  /** 会话归属用户 ID */
  ownerUserId: Schema.Types.ObjectId;
  /** 会话标题，用于列表展示 */
  title: string;
  /** 会话类型，用于区分普通对话、助手对话或 agent 对话 */
  sessionType: AiSessionType;
  /** 会话状态，用于归档或软删除 */
  status: AiSessionStatus;
  /** 最新一条消息 ID，便于快速关联会话尾消息 */
  lastMessageId?: Schema.Types.ObjectId;
  /** 最新消息摘要，用于会话列表预览 */
  lastMessagePreview: string;
  /** 当前会话内的消息总数 */
  messageCount: number;
  /** 是否置顶 */
  pinned: boolean;
  /** 扩展元数据，例如模型配置或业务标签 */
  metadata?: Schema.Types.Mixed;
  /** 最近一条消息时间，用于会话排序 */
  lastMessageAt?: Date;
  /** 创建时间 */
  createdAt?: Date;
  /** 更新时间 */
  updatedAt?: Date;
}

const AiSessionSchema = new Schema<AiSessionDocument>(
  {
    /** 会话归属用户 ID */
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },
    /** 会话标题，用于列表展示 */
    title: {
      type: String,
      default: "新会话",
      max: 100,
      trim: true,
    },
    /** 会话类型，用于区分普通对话、助手对话或 agent 对话 */
    sessionType: {
      type: String,
      enum: Object.values(AiSessionType),
      default: AiSessionType.NORMAL,
    },
    /** 会话状态，用于归档或软删除 */
    status: {
      type: String,
      enum: Object.values(AiSessionStatus),
      default: AiSessionStatus.ACTIVE,
      index: true,
    },
    /** 最新一条消息 ID，便于快速关联会话尾消息 */
    lastMessageId: {
      type: Schema.Types.ObjectId,
      ref: "ai_session_messages",
      default: void 0,
    },
    /** 最新消息摘要，用于会话列表预览 */
    lastMessagePreview: {
      type: String,
      default: "",
      max: 500,
    },
    /** 当前会话内的消息总数 */
    messageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** 是否置顶 */
    pinned: {
      type: Boolean,
      default: false,
    },
    /** 扩展元数据，例如模型配置或业务标签 */
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    /** 最近一条消息时间，用于会话排序 */
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

AiSessionSchema.index({ ownerUserId: 1, status: 1, lastMessageAt: -1 });
AiSessionSchema.index({ ownerUserId: 1, pinned: -1, lastMessageAt: -1 });

export default model<AiSessionDocument>("ai_sessions", AiSessionSchema);
