import { Schema, model} from "mongoose";

export interface UserContactsDocument{
  sender: Schema.Types.ObjectId,
  receiver: Schema.Types.ObjectId,
  createTime?: Date,
}
// 消息栏-聊天好友表
const userContactSchema = new Schema<UserContactsDocument>({
  sender: { // 发送方
    type: Schema.Types.ObjectId,
    require: true,
    ref: 'Users'
  },
  receiver: { // 接收方
    type: Schema.Types.ObjectId,
    require: true,
    ref: 'Users'
  },
  createTime: {
    type: Date
  }, // 创建时间
})

export default model<UserContactsDocument>("UserContacts", userContactSchema)