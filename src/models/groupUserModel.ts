import dayjs from 'dayjs';
import { Schema, model } from 'mongoose';

const { Types } = Schema;
export interface GroupUserDocument {
  groupId: Schema.Types.ObjectId,
  userId: Schema.Types.ObjectId,
  state: 0 | 1 | 2,
  time?: Date,
}
const GroupUserSchema = new Schema<GroupUserDocument>({
  groupId: {   // 群id
    type: Types.ObjectId,
    ref: "groups"
  },
  userId: {   // 用户id
    type: Types.ObjectId,
    ref: "Users",
  },
  state: { // 状态（0:申请中，1:已为加入该群，2:未加入群）
    type: Number,
    enum: [0, 1, 2]
  },  
  time: { // 创建时间
    type: Date,
    default: new Date(),
    getter: (v: Date) => dayjs(v).format("YYYY-MM-DD HH:mm:ss")
  }
})

export default model<GroupUserDocument>("group_user", GroupUserSchema)