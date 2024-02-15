import dayjs from "dayjs";
import { Schema, model } from "mongoose";

const { Types } = Schema;
const FriendSchema = new Schema({
  userId: {
    type: Types.ObjectId,
    ref: "Users"
  },
  friendId: {
    type: Types.ObjectId,
    ref: "Users"
  },
  createTime: {
    type: Date,
    default: Date.now,
    get: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
  },
})

export default model("friends", FriendSchema)