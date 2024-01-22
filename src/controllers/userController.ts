import UserModel, { UserDocument } from "../models/usersModel";
import FriendsModel from "../models/friendsModel";
import Jwt from "../jwt/Jwt";
import { createRes } from "../models/responseModel";
import { $ErrorCode, $ErrorMessage, $SuccessCode } from "../constant/errorData";
import { Context } from "koa";

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

export const socket_findOneUser = async (userId: string) => {
  const userInfo = await UserModel.findOne({_id: userId});
  return userInfo
}