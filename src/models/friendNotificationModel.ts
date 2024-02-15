import { Schema, model } from 'mongoose';
import { ApplyStatusEnum } from '../constant/commonTypes';
import dayjs from 'dayjs';

const { Types } = Schema;
export interface FriendNotificationDocument {
  userId: Schema.Types.ObjectId,
  friendId: Schema.Types.ObjectId,
  status: ApplyStatusEnum,
  applyTime?: Date,
}
const FriendNotificationSchema = new Schema<FriendNotificationDocument>({
  userId: {
    type: Types.ObjectId,
    ref: "Users"
  },
  friendId: {
    type: Types.ObjectId,
    ref: "Users"
  },
  status: {
    type: Number,
    default: 0, // 0申请中， 1申请通过 2申请拒绝
    enum: [0, 1, 2]
  },
  applyTime: {
    type: Date,
    default: Date.now,
    get: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
  },
});

export default model<FriendNotificationDocument>('friend_notification', FriendNotificationSchema);
