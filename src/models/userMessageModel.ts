import dayjs from "dayjs";
import { Schema, model } from "mongoose";

export interface UserMessageDocument {
  fromId: Schema.Types.ObjectId,
  toId: Schema.Types.ObjectId,
  msgType: number,
  msgContent: Schema.Types.Mixed,
  time: Date,
  state: number,
}
// 用户一对一聊天记录
const UserMessage = new Schema<UserMessageDocument>({
  fromId: {
    type: Schema.Types.ObjectId,
    ref: 'Users',
  },
  toId: {
    type: Schema.Types.ObjectId,
    ref: 'Users',
  },
  msgType: { // 消息类型（0:文字（包括表情包）, 1:图片, 2: 视频消息）
    type: Number,
  },
  msgContent: {
    type: Schema.Types.Mixed,
  },
  time: {
    type: Date,
    default: new Date(),
    getter: (v: Date) => dayjs(v).format("YYYY-MM-DD HH:mm:ss")
  },
  state: {  // 已读未读 未读0 已读1
    type: Number,
    default: 0
  }
})

export default model<UserMessageDocument>('user_message', UserMessage)