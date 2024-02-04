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
    default: new Date(),
  },
})

export default model("friends", FriendSchema)