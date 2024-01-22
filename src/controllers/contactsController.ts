import { Context } from 'koa';
import { createRes } from '../models/responseModel';
import UserContactsModel from '../models/userContactsModel';
import UserMessageModel from '../models/userMessageModel';

// 查询聊天栏列表
export const loadUserContacts = async (ctx: Context) => {
  const { userId } = (ctx.request.body as any);
  const contactList = await UserContactsModel
    .find({sender: userId}, null, {lean: true})
    .populate({
      path: 'sender',
      model: "Users",
      select: ["username", "avatarImage", "token"],
    })
    .populate({
      path: 'receiver',
      model: "Users",
      select: ["username", "avatarImage", "token"],
    });
  const newContactList = await Promise.all(contactList.map(async (contact: any) => {
    const messageList = await UserMessageModel
      .find({ $or: [
        {fromId: contact.sender._id, toId: contact.receiver._id}, 
        {fromId: contact.receiver._id, toId: contact.sender._id},
      ] })
      .sort({ time: -1 })
      .limit(1);
    contact.recentMesage = messageList[0];
    return contact
  }));
  ctx.body = createRes(10000, {
    contactList: newContactList || []
  }, "")
}