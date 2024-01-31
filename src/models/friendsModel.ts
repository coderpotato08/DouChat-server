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
  status: {
    type: Number,
    default: 0, // 0申请中， 1申请通过 2申请拒绝
    enum: [0, 1, 2]
  },
  createTime: {
    type: Date,
    default: new Date(),
  },
  applyTime: {
    type: Date,
  }
})

export default model("friends", FriendSchema)