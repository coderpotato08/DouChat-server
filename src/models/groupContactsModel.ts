import dayjs from "dayjs";
import { Schema, model } from "mongoose";

export interface GroupContactsDocument {
  userId: Schema.Types.ObjectId,
  groupId: Schema.Types.ObjectId,
  createTime?: Date,
  unreadNum: number,
}

const groupContactsSchema = new Schema<GroupContactsDocument>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  groupId: {
    type: Schema.Types.ObjectId,
    ref: "groups",
    required: true,
  },
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

export default model<GroupContactsDocument>("group_contacts", groupContactsSchema)
