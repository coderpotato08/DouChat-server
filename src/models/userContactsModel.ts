import dayjs from "dayjs";
import { Schema, model} from "mongoose";

export interface UserContactsDocument{
  contactId: string
  users: [Schema.Types.ObjectId, Schema.Types.ObjectId]
  createTime?: Date,
  unreadNum?: number
}
// 消息栏-聊天好友表
const userContactSchema = new Schema<UserContactsDocument>({
  contactId: {
    type: String,
    required: true,
    unique: true,
  },
  users: [{
    type: Schema.Types.ObjectId,
    require: true,
    ref: 'Users',
  }],
  createTime: {
    type: Date,
    default: Date.now,
    get: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
  },
  unreadNum: {
    type: Number,
    default: 0,
  }
})

export default model<UserContactsDocument>("UserContacts", userContactSchema)