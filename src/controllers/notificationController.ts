import { model } from 'mongoose';
import { Context } from "koa";
import FriendNotificationModel from "../models/friendNotificationModel";
import GroupNotificationModel from "../models/groupNotificationModel";
import UserContactsModel from '../models/userContactsModel';
import GroupContactsModel from '../models/groupContactsModel';
import UserMessageModel from '../models/userMessageModel';
import GroupMessageReadModel from '../models/groupMessageReadModel';
import { 
  DeleteFriendNotificationParams,
  DeleteGroupNotificationParams, 
  FriendNotificationsParams, 
  LoadAllUnreadMessageNumParams, 
  LoadGroupNotificationsParams, 
} from "../constant/apiTypes";
import { $ErrorCode, $ErrorMessage, $SuccessCode } from "../constant/errorData";
import { createRes } from "../models/responseModel";
import dayjs from 'dayjs';

export const deleteFriendNotification = async (ctx: Context) => {
  const { nid } = (ctx.request.body as DeleteFriendNotificationParams);
  try {
    await FriendNotificationModel.deleteOne({ _id: nid });
    ctx.body = createRes($SuccessCode, {
      status: "success",
    }, "")
  } catch(err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

export const loadFriendNotifications = async (ctx: Context) => {  // 查询好友通知记录
  const { userId } = (ctx.request.body as FriendNotificationsParams);
  try { 
    const list = await FriendNotificationModel
      .find({ friendId: userId })
      .populate({
        path: 'userId',
        model: "Users",
        select: ["nickname", "username", "avatarImage"],
      })
      .sort({ status: 1 })
    ctx.body = createRes($SuccessCode, list || [], "")
  } catch(err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}


export const loadGroupNotifications = async (ctx: Context) => {
  const { userId } = (ctx.request.body as LoadGroupNotificationsParams);
  try {
    const list = await GroupNotificationModel
      .find({ userId }, null, {lean: true})
      .populate({
        path: 'inviterId',
        model: "Users",
        select: ["username", "avatarImage", "nickname"],
      })
      .populate({
        path: 'groupId',
        model: "groups",
        select: ["groupName", "groupNumber", "sign"],
      })
      .sort({ createTime: -1})
    ctx.body = createRes($SuccessCode, list.map((note) => {
      const { inviterId, groupId, ...rest } = note
      return {
        ...rest,
        inviter: inviterId,
        groupInfo: groupId
      }
    }), "")
  } catch (err) {
    console.log(err)
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, err)
  }
}

export const deleteGroupNotification = async (ctx: Context) => {
  const { nid } = (ctx.request.body as DeleteGroupNotificationParams);
  try {
    await GroupNotificationModel.deleteOne({_id: nid});
    ctx.body = createRes($SuccessCode, {
      status: "success",
    }, "")
  } catch(err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, err)
  }
}

export const loadAllUnreadCounts = async (ctx: Context) => {
  const { userId } = (ctx.request.body as LoadAllUnreadMessageNumParams);
  try {
    const reg = new RegExp(`^${userId}`)
    const [userContactList, groupContactList] = await Promise.all([
      UserContactsModel.find({contactId: reg}),
      GroupContactsModel.find({userId}),
    ])
    const contactUnreadList = await Promise.all(userContactList.map(async (contact) => {
      const userIds = contact.contactId.split("_");
      // 要查对方发过来的未读消息 fromId对方 toId我
      const fromId = userId === userIds[0] ? userIds[1] : userIds[0]; 
      const toId = userId === userIds[0] ? userIds[0] : userIds[1];
      const unReadCount = await UserMessageModel.countDocuments({
        $and: [
          { fromId, toId, state: 0 }, // 当前聊天栏，未读
          { time: { $gt: contact.createTime } }
        ]
      })
      return unReadCount
    }))
    const groupUnreadList = await Promise.all(groupContactList.map(async (contact) => {
      const { userId, groupId, createTime } = contact;
      const messages = await GroupMessageReadModel
        .find({ userId, groupId, unread: true }, null, {lean: true})
        .populate({
          path: "messageId",
          model: "group_messages",
          select: ["time"]
        })
      const unReadCount = messages.filter(({messageId}) => 
        dayjs((messageId as any).time).diff(dayjs(createTime)) > 0
      ).length
      return unReadCount
    }))
    const userUnreadCount = contactUnreadList.reduce((a, b) => a += b, 0);
    const groupUnreadCount = groupUnreadList.reduce((a, b) => a += b, 0);
    ctx.body = createRes($SuccessCode, {
      // num: userUnreadList.length + groupUnreadList.length
      userUnreadCount,
      groupUnreadCount
    }, "")
  } catch(err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}