const { createRes } = require('../models/responseModel');
const UserContactsModel = require('../models/userContactsModel')

// 查询聊天栏列表
const loadUserContacts = async (ctx) => {
  const { request } = ctx;
  const { userId } = request.body;
  const contactList = await UserContactsModel
    .find({sender: userId})
    .populate({
      path: 'sender',
      module: "Users",
      select: ["username", "avatarImage", "token"],
    })
    .populate({
      path: 'receiver',
      module: "Users",
      select: ["username", "avatarImage", "token"],
    });
  ctx.body = createRes(10000, {
    contactList: contactList || []
  }, "")
}

module.exports = {
  loadUserContacts
}