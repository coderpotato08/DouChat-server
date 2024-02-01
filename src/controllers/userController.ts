import UserModel from "../models/usersModel";
import FriendsModel from "../models/friendsModel";
import UserContactsModel from "../models/userContactsModel";
import UserMessageModel from "../models/userMessageModel";
import Jwt from "../jwt/Jwt";
import { createRes } from "../models/responseModel";
import { $ErrorCode, $ErrorMessage, $SuccessCode } from "../constant/errorData";
import { Context } from "koa";
import { 
  DeleteFriendParams,
  FriendNotificationsParams,
  FriendStatusChangeParams,
  LoadUserInfoParams,
  RegisterParams,
} from "../constant/apiTypes";

export const login = async (ctx: Context) => {
  const { username, password } = (ctx.request.body as any);
  const userFind: any = await UserModel.findOne({username});
  let responseData = {};
  try {
    if (userFind) {
      if(userFind.password === password) {
        const jwt = new Jwt({ username });
        const token = jwt.generateToken();
        delete userFind.password;
        const updateUserRes = await UserModel.updateOne({ _id: userFind._id }, { token });
        responseData = createRes(10000, { 
          userInfo: userFind,
          token
        }, "")
      } else {
        responseData = createRes(
          $ErrorCode.PASSWORD_INVALID_ERROR, 
          null, 
          $ErrorMessage.PASSWORD_INVALID_ERROR
        )
      }
    } else {
      responseData = createRes(
        $ErrorCode.USERNAME_UNFOUND_ERROR, 
        null, 
        $ErrorMessage.USERNAME_UNFOUND_ERROR
      )
    }
    ctx.body = responseData
  } catch(err) {
    responseData = createRes(
      $ErrorCode.SERVER_ERROR,
      null, 
      $ErrorMessage.SERVER_ERROR
    )
    ctx.body = responseData
  }
}

export const register = async (ctx: Context) => { // 注册
  const registerParams = (ctx.request.body as RegisterParams);
  const {} = registerParams;
  try {
    const userInfo = UserModel.create(registerParams);
    ctx.body = createRes($SuccessCode, {
      status: "success"
    }, "")
  } catch(err) {
    ctx.body = createRes($ErrorCode.SERVER_ERROR,null,$ErrorMessage.SERVER_ERROR);
  }
}

export const searchUser = async (ctx: Context) => { // 模糊查询用户
  const { keyWord, currUserId } = (ctx.request.body as any);
  const regex = new RegExp(keyWord, 'i');
  try {
    const userList = await UserModel.find({
      $or: [
        { nickname: regex },
        { username: regex },
      ],
    }, null, {lean: true});
    const newUserList = await Promise.all(userList.map(async (userInfo: any) => {
      const existfriend = await FriendsModel.findOne({
        $or: [
          { userId: userInfo._id.toString(), friendId: currUserId },
          { friendId: userInfo._id.toString(), userId: currUserId }
        ]
      })
      userInfo.isFriend = existfriend && existfriend.status == 1;
      return userInfo;
    }))
    ctx.body = createRes($SuccessCode, {
      count: keyWord ? userList.length : 0,
      userList: keyWord ? newUserList : [],
    }, "")
  } catch(err) {
    ctx.body = createRes(
      $ErrorCode.SERVER_ERROR,
      null, 
      $ErrorMessage.SERVER_ERROR
    );
  }
}

export const loadUserInfo = async (ctx: Context) => { // 查询用户信息
  const { userId } = (ctx.request.body as LoadUserInfoParams);
  try {
    const userInfo = await UserModel.findOne({
      _id: userId
    }, {
      password: 0,
      __v: 0,
    }, {
      lean: true
    });
    ctx.body = createRes($SuccessCode, userInfo, "")
  } catch(err) {
    console.log(err)
    ctx.body = createRes(
      $ErrorCode.SERVER_ERROR,
      null, 
      $ErrorMessage.SERVER_ERROR
    );
  }
}

export const addFriend = async (ctx: Context) => {  // 添加好友
  const { userId, friendId } = (ctx.request.body as any);
  const filter = {
    $or: [
      { userId, friendId },
      { userId: friendId, friendId: userId },
    ],
  }
  const relationship = await FriendsModel.findOne(filter);
  if(relationship) {
    if(relationship.status == 0) {
      ctx.body = createRes($SuccessCode, {
        status: "success",
        message: "已申请添加好友，请等待申请通过"
      }, "")
    } else if(relationship.status == 2) {
      await FriendsModel.updateOne(filter, { status: 0 });
      ctx.body = createRes($SuccessCode, {
        status: "success",
        message: "申请成功"
      }, "")
    }
  } else {
    await FriendsModel.create({ userId, friendId, status: 0 });
    ctx.body = createRes($SuccessCode, {
      status: "success",
      message: "申请成功"
    }, "")
  }
}

export const loadFriendNotifications = async (ctx: Context) => {  // 查询好友关系
  const { userId } = (ctx.request.body as FriendNotificationsParams);
  try { 
    const friendList = await FriendsModel
      .find({
        friendId: userId,
        status: 0
      })
      .populate({
        path: 'userId',
        model: "Users",
        select: ["nickname", "username", "avatarImage"],
      })
      .sort({ status: 1 })
    ctx.body = createRes($SuccessCode, {
      friendList
    }, "")
  } catch(err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

export const loadFriendList = async (ctx: Context) => {  // 查询好友列表
  const { userId } = (ctx.request.body as FriendNotificationsParams);
  try {
    const friendList = await FriendsModel
      .find({$or: [{ friendId: userId, status: 1 }, { userId, status: 1 }]}, null, {lean: true})
      .populate({
        path: 'userId',
        model: "Users",
        select: ["nickname", "username", "avatarImage"],
      })
      .populate({
        path: 'friendId',
        model: "Users",
        select: ["nickname", "username", "avatarImage"],
      })
      .sort({ status: 1 })
  
    ctx.body = createRes($SuccessCode, {
      friendList: friendList.map((item) => {
        const { friendId: friendInfo, userId: userInfo, ...rest } = item;
        const info = userInfo!._id.toString() == userId ? friendInfo : userInfo;
        return {
          ...rest,
          friendInfo: info
        }
      })
    }, "")
  } catch(err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

export const changetFriendStatus = async (ctx: Context) => {  // 同意/拒绝好友申请
  const { id, changeStatus } = (ctx.request.body as FriendStatusChangeParams);
  try {
    const relationship = await FriendsModel
      .findOne({_id: id}, null, {lean: true});
    if(relationship) {
      const result = await FriendsModel.updateOne({ _id: id }, { status: changeStatus });
      if (result.modifiedCount > 0) {
        ctx.body = createRes($SuccessCode, {
          status: "success",
          relationship: {
            ...relationship,
            status: changeStatus
          }
        }, "")
      } else {
        ctx.body = createRes($ErrorCode.FRIENDSHIP_NOT_EXIST, null, "")
      }
    }
  } catch(err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

export const deleteFriend = async (ctx: Context) => {
  const { userId, friendId } = (ctx.request.body as DeleteFriendParams);
  try {
    await FriendsModel.deleteOne({$or: [  // 删除好友关系
      {userId, friendId},
      {userId: friendId, friendId: userId}
    ]});
    await UserContactsModel.deleteMany({  // 删除好友关系
      users: {$all: [userId, friendId]}
    })
    await UserMessageModel.deleteMany({$or: [ // 删除聊天记录
      {fromId: userId, toId: friendId},
      {fromId: friendId, toId: userId}
    ]})
    ctx.body = createRes($SuccessCode, { status: "success" }, "")
  } catch (err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

export const socket_findOneUser = async (userId: string) => {
  const userInfo = await UserModel.findOne({_id: userId});
  return userInfo
}