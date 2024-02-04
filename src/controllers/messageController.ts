import UserMessageModel from '../models/userMessageModel';
import GroupMessageModel from '../models/groupMessageModel';
import GroupMessageReadModel from '../models/groupMessageReadModel';
import GroupUserModel from '../models/groupUserModel';
import { createRes } from "../models/responseModel";
import { $SuccessCode, $ErrorCode, $ErrorMessage } from "../constant/errorData";
import { Context } from 'koa';
import { AddGroupMessageUnreadParams, CleanGroupMessageUnreadParams, LoadGroupMessageListParams } from '../constant/apiTypes';

export const saveUserMessage = async (data: any) => {
  const { fromId, toId } = data;
  const newMessage = await UserMessageModel.create(data);
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
    ctx.body = createRes($SuccessCode, messageList, "")
  } catch(err) {
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }  
}

export const loadGroupMessageList = async (ctx: Context) => {
  const { groupId } = (ctx.request.body as LoadGroupMessageListParams);
  try {
    const messageList = await GroupMessageModel
      .find({ groupId })
      .populate({
        path: 'fromId',
        model: "Users",
        select: ["username", "avatarImage", "nickname"],
      })
      .sort({ time: 1 })
    ctx.body = createRes($SuccessCode, messageList, "")
  } catch(err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

export const socket_SaveGroupMessage = async (data: any) => {
  const newMessage = await GroupMessageModel.create(data);
  const result = await GroupMessageModel
    .findOne({_id: newMessage._id})
    .populate({
      path: 'fromId',
      model: "Users",
      select: ["username", "avatarImage", "nickname"],
    })
  return result;
}

export const socket_GroupMessageUnread = async ({ 
  groupId,
  userId,
  messageId 
}: AddGroupMessageUnreadParams) => {
  try {
    const users = await GroupUserModel.find({
      groupId,
      userId: { $ne: userId }
    });
    for (let i = 0; i < users.length; i++) {
      const curUserId = users[i].userId.toString();
      await GroupMessageReadModel.create({
        userId: curUserId,
        messageId,
        groupId,
      })
    }
  } catch(err) {
    console.log(err)
  }
}

export const socket_CleanGroupMessageUnread = async ({
  groupId,
  userId,
  messageId 
}: CleanGroupMessageUnreadParams) => {
  const filter = messageId ? { groupId, userId, messageId } : { groupId, userId }
  try {
    await GroupMessageReadModel.updateMany(filter, { unread: false })
  } catch(err) {
    console.log(err)
  }
}