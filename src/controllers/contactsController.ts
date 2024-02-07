import { Context } from 'koa';
import { Types } from 'mongoose';
import { createRes } from '../models/responseModel';
import UserContactsModel from '../models/userContactsModel';
import UserMessageModel from '../models/userMessageModel';
import GroupContactsModel from '../models/groupContactsModel';
import GroupMessageModel from '../models/groupMessageModel';
import GroupUserModel from '../models/groupUserModel';
import GroupMessageReadModel from '../models/groupMessageReadModel';
import { 
  CreateGroupContactParams,
  CreateUserContactParams,
  LoadContactListParams,
  LoadContactParams,
  LoadGroupContactParams
} from '../constant/apiTypes';
import { $ErrorCode, $ErrorMessage, $SuccessCode } from '../constant/errorData';
import dayjs from 'dayjs';

// 查询聊天栏列表
export const loadUserContactList = async (ctx: Context) => {
  const { userId } = (ctx.request.body as LoadContactListParams);
  let reg = new RegExp(`^${userId}`)
  const contactList = await UserContactsModel
    .find({contactId: reg}, null, {lean: true})
    .populate({
      path: 'users',
      model: "Users",
      select: ["nickname", "username", "avatarImage", "token"],
    })
  const newContactList = await Promise.all(contactList.map(async (contact: any) => {
    const { users, createTime } = contact;
    const fromId = users[0]._id.toString() === userId ? users[1]._id : users[0]._id
    const messageList = await UserMessageModel
      .find({ fromId, toId: userId, time: { $gt: contact.createTime } })
      .sort({ time: -1 });
    const recentMessageList = await UserMessageModel
      .find({ $or: [
        {fromId, toId: userId, time: { $gt: createTime }},
        {fromId: userId, toId: fromId, time: { $gt: createTime }},
      ] })
      .sort({ time: -1 })
      .limit(1)
    contact.unreadNum = messageList.filter((message) => message.state === 0).length
    contact.recentMessage = recentMessageList[0];
    return contact
  }));
  ctx.body = createRes($SuccessCode, newContactList || [], "")
}

// 加载单个聊天栏
export const loadUserContact = async (ctx: Context) => {
  const { contactId } = (ctx.request.body as LoadContactParams);
  try {
    const contact = await UserContactsModel
      .findOne({contactId})
      .populate({
        path: 'users',
        model: "Users",
        select: ["nickname", "username", "avatarImage", "token"],
      })
    ctx.body = createRes($SuccessCode, contact, "")
  } catch (err) {
    console.log(err)
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

export const createUserContact = async (ctx: Context) => {
  const { fromId, toId } = (ctx.request.body as CreateUserContactParams);
  try {
    const contactId = `${fromId}_${toId}`
    const contact = await UserContactsModel.findOne({contactId})
    if (!contact) {
      await UserContactsModel.create({
        contactId,
        users: [fromId, toId],
        createTime: new Date(),
      });
    }
    ctx.body = createRes($SuccessCode, {
      status: "success",
      contactId
    }, "")
  } catch(err) {
    console.log(err)
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

// 新建用户 => 群聊栏映射
export const createGroupContact = async (ctx: Context) => {
  const { userId, groupId } = (ctx.request.body as CreateGroupContactParams);
  const existContact = await GroupContactsModel.findOne({userId, groupId});
  try {
    if(existContact) {
      ctx.body = createRes($SuccessCode, {
        groupId,
        status: "success",
      }, "")
    } else {
      const groupContact = await GroupContactsModel.create({
        userId,
        groupId,
        createTime: new Date(),
      });
      ctx.body = createRes($SuccessCode, {
        groupId: groupContact._id,
        status: "success",
      }, "")
    }
  } catch(err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

// 查询群聊天栏列表
export const loadGroupContactList = async (ctx: Context) => {
  const { userId } = (ctx.request.body as LoadContactListParams);
  try {
    const list = await GroupContactsModel
      .aggregate([
        {$match: { userId: new Types.ObjectId(userId) }},
        {
          $lookup: {
            from: 'groups',
            localField: 'groupId',
            foreignField: '_id',
            as: 'groupInfo'
          }
        }
      ])
    const groupContactList = await Promise.all(list.map(async (groupContact) => {
      const { groupId, groupInfo, ...rest } = groupContact
      const [usersList, recentMessageList, unreadNum] = await Promise.all([
        // 处理群头图，取前4用户的头像
        await GroupUserModel  
          .find({ groupId, status: 1 }, { userId: 1 }, { lean: true })
          .populate({
            path: "userId",
            model: "Users",
            select: ["username", "avatarImage"],
          })
          .sort({time: 1})
          .limit(4),
        // 处理最近一条消息
        await GroupMessageModel
          .find({ groupId, time: { $gt: groupContact.createTime } })
          .sort({ time: -1 })
          .limit(1),
        // 处理未读消息数
        (async () => {
          const messages =  await GroupMessageReadModel
            .find({ groupId, userId, unread: true })
            .populate({
              path: "messageId",
              model: "group_messages",
              select: ["time"]
            });
          const unReadCount = messages.filter(({messageId}) => 
            dayjs((messageId as any).time).diff(dayjs(groupContact.createTime)) > 0
          ).length
          return unReadCount;
        })()
      ])
      return { 
        ...rest,
        groupId,
        groupInfo: {
          ...groupInfo[0], 
          usersAvaterList: usersList.map((item: any) => item.userId?.avatarImage)
        },
        unreadNum,
        recentMessage: recentMessageList[0],
      }
    }))
    ctx.body = createRes($SuccessCode, groupContactList || [], "");
  } catch (err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}


export const loadGroupContact =  async (ctx: Context) => {
  const { userId, groupId } = (ctx.request.body as LoadGroupContactParams);
  try {
    const list = await await GroupContactsModel
      .aggregate([
        {$match: { userId: new Types.ObjectId(userId), groupId: new Types.ObjectId(groupId) }},
        {
          $lookup: {
            from: 'groups',
            localField: 'groupId',
            foreignField: '_id',
            as: 'groupInfo'
          }
        }
      ])
    const groupContact = list[0];
    const usersList = await GroupUserModel
      .find({ groupId, status: 1 }, { userId: 1 }, { lean: true })
      .populate({
        path: "userId",
        model: "Users",
        select: ["username", "avatarImage"],
      })
      .sort({time: 1})
    ctx.body = createRes($SuccessCode, {
      ...groupContact,
      groupInfo: {
        ...groupContact.groupInfo[0],
        usersList,
        usersAvaterList: usersList
          .slice(0, 4)
          .map((item: any) => item.userId?.avatarImage)
      }
    }, "");
  } catch (err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

export const deleteUserContact = async (ctx: Context) => {
  const { id } = (ctx.request.body as any);
  try {
    await UserContactsModel.deleteOne({_id: id});
    ctx.body = createRes($SuccessCode, { status: "success" }, "")
  } catch(err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

export const deleteGroupContact = async (ctx: Context) => {
  const { id } = (ctx.request.body as any);
  try {
    await GroupContactsModel.deleteOne({_id: id});
    ctx.body = createRes($SuccessCode, { status: "success" }, "")
  } catch(err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

export const addContactUnread = async (contactId: string) => {
  const contact = await UserContactsModel.findOne({ contactId });
  if(contact) {
    await UserContactsModel.updateOne({ contactId }, {
      unreadNum: (contact.unreadNum || 0) + 1
    });
  };
}

export const cleanContactUnread = async (fromId: string, toId: string) => {
  await UserMessageModel.updateMany({ fromId, toId }, { state: 1 })
}
