import { Context } from 'koa';
import { createRes } from '../models/responseModel';
import UserContactsModel from '../models/userContactsModel';
import UserMessageModel from '../models/userMessageModel';
import { LoadContactListParams, LoadContactParams } from '../constant/apiTypes';
import { $ErrorCode, $ErrorMessage, $SuccessCode } from '../constant/errorData';

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
    const { users } = contact;
    const fromId = users[0]._id.toString() === userId ? users[1]._id : users[0]._id
    const messageList = await UserMessageModel
      .find({ fromId, toId: userId })
      .sort({ time: -1 });
    const recentMessageList = await UserMessageModel
      .find({ $or: [
        {fromId, toId: userId},
        {fromId: userId, toId: fromId},
      ] })
      .sort({ time: -1 })
      .limit(1)
    contact.unreadNum = messageList.filter((message) => message.state === 0).length
    contact.recentMessage = recentMessageList[0];
    return contact
  }));
  ctx.body = createRes($SuccessCode, {
    contactList: newContactList || []
  }, "")
}

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
    if(contact) {
      ctx.body = createRes($SuccessCode, contact, "")
    } else {
      const users = contactId.split("_");
      const newContact = await UserContactsModel
        .create({
          contactId,
          users,
          createTime: new Date(),
        })
      ctx.body = createRes($SuccessCode, newContact, "")
    }
  } catch (error) {
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

export const addContactUnread = async (contactId: string) => {
  const contact = await UserContactsModel.findOne({ contactId });
  if(contact) {
    await UserContactsModel.updateOne({ contactId }, {
      unreadNum: contact.unreadNum + 1
    });
  };
}

export const cleanContactUnread = async (fromId: string, toId: string) => {
  await UserMessageModel.updateMany({ fromId, toId }, { state: 1 })
}