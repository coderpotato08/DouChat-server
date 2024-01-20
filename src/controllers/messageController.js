const UserMessageModel = require('../models/userMessageModel');
const { createRes } = require("../models/responseModel");
const { $SuccessCode, $ErrorCode, $ErrorMessage } = require("../constant/errorData");

const saveUserMessage = async (data) => {
  const { fromId, toId } = data;
  const result = await UserMessageModel
    .create(data);
  return result;
}

const loadMessageList = async (ctx) => {
  const { request } = ctx
  const { fromId, toId } = request.body;
  try {
    const messageList = await UserMessageModel
      .find({
        $or: [{fromId, toId}, {fromId: toId, toId: fromId}]
      })
      .populate({
        path: 'fromId',
        module: "Users",
        select: ["username", "avatarImage"],
      })
      .populate({
        path: 'toId',
        module: "Users",
        select: ["username", "avatarImage"],
      })
      .sort({ time: 1 })
    ctx.body = createRes($SuccessCode, {
      messageList,
    }, "")
  } catch(err) {
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }  
}

module.exports = {
  saveUserMessage,
  loadMessageList,
}