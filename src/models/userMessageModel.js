const mongoose = require('mongoose');

const { Schema: { Types } } = mongoose
// 用户一对一聊天记录
const UserMessage = new mongoose.Schema({
  fromId: {
    type: Types.ObjectId,
    ref: 'Users',
  },
  toId: {
    type: Types.ObjectId,
    ref: 'Users',
  },
  msgType: { // 消息类型（0:文字（包括表情包）, 1:图片, 2: 视频消息）
    type: Number,
  },
  msgContent: {
    type: Types.Mixed,
  },
  time: {
    type: Date,
  },
  state: {  // 已读未读 未读0 已读1
    type: Number,
    default: 0
  }
})

module.exports = mongoose.model('user_message', UserMessage)