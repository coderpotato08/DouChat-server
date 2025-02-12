import dayjs from 'dayjs';
import { Schema, model } from 'mongoose';

const { Types } = Schema;
export interface GroupMessageDocument {
  fromId?: Schema.Types.ObjectId,
  groupId: Schema.Types.ObjectId,
  msgType: number,
  msgContent: Schema.Types.Mixed,
  time?: Date,
}
const GroupMessageModel = new Schema<GroupMessageDocument>({
  fromId: {
    type: Types.ObjectId,
    ref: 'Users',
  },
  groupId: {
    type: Types.ObjectId,
    ref: 'groups'
  },
  msgType: { // 消息类型（0:文字（包括表情包）, 1:图片, 2: 视频消息）
    type: Number,
  },
  msgContent: {
    type: Schema.Types.Mixed,
  },
  time: {
    type: Date,
    default: Date.now,
    get: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
  },
})

export default model<GroupMessageDocument>('group_messages', GroupMessageModel)