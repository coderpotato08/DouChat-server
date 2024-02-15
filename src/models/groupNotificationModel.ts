import dayjs from 'dayjs';
import { Schema, model } from 'mongoose';

const { Types } = Schema;
export interface GroupNotificationDocument {
  inviterId: Schema.Types.ObjectId,
  groupId: Schema.Types.ObjectId,
  userId: Schema.Types.ObjectId,
  status: 0 | 1 | 2,
  createTime?: Date,
}

const GroupNotificationSchema = new Schema<GroupNotificationDocument>({
  inviterId: {   // 群id
    type: Types.ObjectId,
    ref: "Users"
  },
  groupId: {   // 群id
    type: Types.ObjectId,
    ref: "groups"
  },
  userId: {   // 用户id
    type: Types.ObjectId,
    ref: "Users",
  },
  status: { // 状态（0:申请中，1:已为加入该群，2:已拒绝未加入群）
    type: Number,
    enum: [0, 1, 2]
  },  
  createTime: { // 创建时间
    type: Date,
    default: Date.now,
    get: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
  }
})

export default model<GroupNotificationDocument>('group_notifications', GroupNotificationSchema)