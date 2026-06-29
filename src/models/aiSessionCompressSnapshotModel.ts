import { Schema, model } from "mongoose";
import { AI_MESSAGE_COMPRESSED_VERSIONS, AiMessageCompressedVersion } from "./aiSessionMessageModel";

export const AI_SESSION_SNAPSHOT_TRIGGER_MODES = ["manual", "auto_token", "idle_timeout"] as const;
export type AiSessionSnapshotTriggerMode = (typeof AI_SESSION_SNAPSHOT_TRIGGER_MODES)[number];

export interface AiSessionCompressSnapshotDocument {
  // 快照全局唯一 ID
  snapshotId: string;
  // 快照所属会话 ID
  sessionId: string;
  // 压缩触发方式
  triggerMode: AiSessionSnapshotTriggerMode;
  // 本次压缩使用的策略
  strategy: AiMessageCompressedVersion;
  // 本次压缩覆盖的 requestId 列表
  coveredRequestIds: string[];
  // 压缩后的整会话上下文文本
  fullCompressedContext: string;
  // 快照创建时间
  createTime?: Date;
  // 是否允许基于该快照执行回滚
  canRollback: boolean;
  // 本次压缩节省的 token 总量
  totalSaveToken: number;
}

const AiSessionCompressSnapshotSchema = new Schema<AiSessionCompressSnapshotDocument>(
  {
    // 快照全局唯一 ID
    snapshotId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    // 快照所属会话 ID
    sessionId: {
      type: String,
      required: true,
      trim: true,
    },
    // 触发压缩的来源类型
    triggerMode: {
      type: String,
      required: true,
      enum: AI_SESSION_SNAPSHOT_TRIGGER_MODES,
    },
    // 本次压缩所采用的策略
    strategy: {
      type: String,
      required: true,
      enum: AI_MESSAGE_COMPRESSED_VERSIONS,
    },
    // 被此次快照覆盖的轮次 ID 集合
    coveredRequestIds: {
      type: [String],
      required: true,
      default: [],
    },
    // 面向上下文恢复或快速拼接的完整压缩文本
    fullCompressedContext: {
      type: String,
      required: true,
      trim: true,
    },
    // 快照创建时间
    createTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // 是否支持回滚原始数据
    canRollback: {
      type: Boolean,
      required: true,
      default: true,
    },
    // 本次压缩节省的 token 总量
    totalSaveToken: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    collection: "ai_chat_compress_snapshots",
    versionKey: false,
  },
);

AiSessionCompressSnapshotSchema.index({ sessionId: 1, createTime: -1 });
AiSessionCompressSnapshotSchema.index({ snapshotId: 1 }, { unique: true });

export default model<AiSessionCompressSnapshotDocument>(
  "ai_chat_compress_snapshots",
  AiSessionCompressSnapshotSchema,
);
