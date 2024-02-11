import { MessageTypeEnum } from './../constant/commonTypes';
import UserContactsModel from '../models/userContactsModel';
import UserMessageModel from '../models/userMessageModel';
import GroupMessageModel from '../models/groupMessageModel';
import GroupMessageReadModel from '../models/groupMessageReadModel';
import GroupContactsModel from '../models/groupContactsModel';
import GroupUserModel from '../models/groupUserModel';
import { createRes } from "../models/responseModel";
import { $SuccessCode, $ErrorCode, $ErrorMessage } from "../constant/errorData";
import { Context } from 'koa';
import { 
  AddGroupMessageUnreadParams,
  CleanGroupMessageUnreadParams,
  LoadGroupMessageListParams,
  SearchListParams
} from '../constant/apiTypes';
import { formatMessageText } from '../utils/common-utils';
import dayjs from 'dayjs';

const messageFilter = (message: any, keyword: string):boolean => {  // 根据文件类型进行关键字匹配
  const { msgContent, msgType } = message; 
  if (msgType === MessageTypeEnum.FILE || msgType === MessageTypeEnum.VIDEO) {  // 文件类型对filename进行关键字匹配
    return msgContent.filename.indexOf(keyword) > -1;
  } else if (msgType === MessageTypeEnum.TEXT) { // 文本类型msgContent => string 对进行关键字匹配
    return msgContent.indexOf(keyword) > -1;
  } else { // 其他类型消息过滤掉
    return false
  }
}
export const saveUserMessage = async (data: any) => {
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
  const { fromId, toId, limitTime } = (ctx.request.body as any);
  const startTime = new Date(limitTime)
  try {
    const messageList = await UserMessageModel
      .find({
        $or: [
          { fromId, toId, time: {$gt: startTime} },
          { fromId: toId, toId: fromId, time: {$gt: startTime} }]
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
  const { groupId, limitTime } = (ctx.request.body as LoadGroupMessageListParams);
  const startTime = new Date(limitTime)
  try {
    const messageList = await GroupMessageModel
      .find({ groupId, time: {$gt: startTime} })
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

export const searchMessageList = async (ctx: Context) => {
  const { userId, keyword } = (ctx.request.body as SearchListParams);
  try {
    const reg = new RegExp(`^${userId}`)
    const [
      userContactList,  // 用户聊天栏
      groupContactList  // 群聊聊天栏
    ] = await Promise.all([
      await UserContactsModel
        .find({contactId: reg}, null, {lean: true})
        .populate({
          path: 'users',
          model: "Users",
          select: ["nickname", "username", "avatarImage"],
        }),
      await GroupContactsModel
        .find({ userId }, null, {lean: true})
        .populate('groupId')
    ]);
    const [
      matchedUserContactList,
      matchedGroupContactList,
    ] = await Promise.all([
      Promise.all(userContactList.map(async (contact: any) => { // 对用户聊天记录进行匹配
        const { users, createTime, contactId } = contact;
        const friendInfo = users[0]._id.toString() === userId ? users[1] : users[0]
        const messages = await UserMessageModel
          .find({
            time: { $gt: createTime },
            $or: [
              {fromId: users[0]._id, toId: users[1]._id},
              {fromId: users[1]._id, toId: users[0]._id},
            ]
          }, {msgContent: 1, time: 1, msgType: 1})
        const matchedMessages = messages
          .filter((message: any) => messageFilter(message, keyword))
          .map(({msgContent, msgType}) => formatMessageText(msgContent, msgType)) // 格式化为展示的文本消息
        return {
          chatId: contactId,
          createTime,
          friendInfo,
          matchedMessages
        }
      })),
      Promise.all(groupContactList.map(async (contact) => { // 对群聊聊天记录进行匹配
        const { groupId, createTime } = contact;
        const userList = await GroupUserModel // 处理群头像
          .find({groupId}, {userId: 1}, {lean: true})
          .populate({
            path: "userId",
            model: "Users",
            select: ["avatarImage"],
          })
          .limit(4)
        const messages = await GroupMessageModel.find({ 
          time: { $gt: createTime },
          groupId,
        }, {msgContent: 1, time: 1, msgType: 1});
        const matchedMessages = messages
          .filter((message: any) => messageFilter(message, keyword))
          .map(({msgContent, msgType}) => formatMessageText(msgContent, msgType)) // 格式化为展示的文本消息
        return {
          chatId: groupId,
          createTime,
          groupInfo: {
            ...contact.groupId,
            usersAvaterList: userList.slice(0, 4).map((item: any) => item.userId.avatarImage),
          },
          matchedMessages,
        };
      }))
    ])
    const contactList = [ // 根据聊天创建时间排序
      ...matchedUserContactList.filter((contact: any) => contact.matchedMessages.length > 0),
      ...matchedGroupContactList.filter((contact: any) => contact.matchedMessages.length > 0)
    ].sort((a, b) => dayjs(a.createTime).diff(dayjs(b.createTime)))
    ctx.body = createRes($SuccessCode, contactList, "");
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