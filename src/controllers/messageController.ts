import UserMessageModel, { UserMessageDocument } from '../models/userMessageModel';
import { createRes } from "../models/responseModel";
import { $SuccessCode, $ErrorCode, $ErrorMessage } from "../constant/errorData";
import { Context } from 'koa';

export const saveUserMessage = async (data: any) => {
  const { fromId, toId } = data;
  const newMessage = await UserMessageModel
    .create(data);
  const result = await UserMessageModel
    .findOne({_id: newMessage._id})
    .populate({
      path: 'fromId',
      model: "Users",
      select: ["username", "avatarImage"],
    })
    .populate({
      path: 'toId',
      model: "Users",
      select: ["username", "avatarImage"],
    })
  return result;
}

export const loadMessageList = async (ctx: Context) => {
  const { fromId, toId } = (ctx.request.body as any);
  try {
    const messageList = await UserMessageModel
      .find({
        $or: [{fromId, toId}, {fromId: toId, toId: fromId}]
      })
      .populate({
        path: 'fromId',
        model: "Users",
        select: ["username", "avatarImage"],
      })
      .populate({
        path: 'toId',
        model: "Users",
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