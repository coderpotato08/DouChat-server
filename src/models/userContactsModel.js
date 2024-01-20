const mongoose = require("mongoose");

// 消息栏-聊天好友表
const userContactSchema = new mongoose.Schema({
  sender: { // 发送方
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users'
  },
  receiver: { // 接收方
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users'
  },
  recentMesage: { // 最近收到的一条消息
    type: String,
  },
  recentSendTime: Date,  // 最近收到一条消息的时间
  createTime: Date, // 创建时间
})

module.exports = mongoose.model("UserContacts", userContactSchema)