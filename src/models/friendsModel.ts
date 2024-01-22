import mongoose from "mongoose";

const { Schema: { Types } } = mongoose
const FriendSchema = new mongoose.Schema({
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
  },
  createTime: {
    type: Date,
    default: new Date(),
  },
  applyTime: {
    type: Date,
  }
})

export default mongoose.model("friends", FriendSchema)