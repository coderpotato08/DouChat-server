import UserModel from "../models/usersModel";
import FriendsModel from "../models/friendsModel";
import FriendNotificationModel from "../models/friendNotificationModel";
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
  SearchListParams,
} from "../constant/apiTypes";
import { ApplyStatusEnum } from "../constant/commonTypes";

export const login = async (ctx: Context) => {
  const { username, password } = ctx.request.body as any;
  const userFind: any = await UserModel.findOne({ username });
  let responseData = {};
  try {
    if (userFind) {
      if (userFind.password === password) {
        const jwt = new Jwt({ username });
        const token = jwt.generateToken();
        delete userFind.password;
        const updateUserRes = await UserModel.updateOne(
          { _id: userFind._id },
          { token }
        );
        responseData = createRes(
          10000,
          {
            userInfo: userFind,
            token,
          },
          ""
        );
      } else {
        responseData = createRes(
          $ErrorCode.Login.PASSWORD_INVALID_ERROR,
          null,
          $ErrorMessage.Login.PASSWORD_INVALID_ERROR
        );
      }
    } else {
      responseData = createRes(
        $ErrorCode.Login.USERNAME_UNFOUND_ERROR,
        null,
        $ErrorMessage.Login.USERNAME_UNFOUND_ERROR
      );
    }
    ctx.body = responseData;
  } catch (err) {
    responseData = createRes(
      $ErrorCode.Common.SERVER_ERROR,
      null,
      $ErrorMessage.Common.SERVER_ERROR
    );
    ctx.body = responseData;
  }
};

export const register = async (ctx: Context) => {
  // 注册
  const registerParams = ctx.request.body as RegisterParams;
  const { username, email, phoneNumber } = registerParams;
  try {
    const sameUsernameUser = await UserModel.findOne({ username });
    if (sameUsernameUser) {
      ctx.body = createRes(
        $ErrorCode.Register.REGISTER_FAIL,
        null,
        "该用户名已被使用，请重新填写！"
      );
      return;
    }
    const sameEmailUser = await UserModel.findOne({ email });
    if (sameEmailUser) {
      ctx.body = createRes(
        $ErrorCode.Register.REGISTER_FAIL,
        null,
        "该邮箱已被使用，请重新填写！"
      );
      return;
    }
    const samePhoneUser = await UserModel.findOne({ phoneNumber });
    if (samePhoneUser) {
      ctx.body = createRes(
        $ErrorCode.Register.REGISTER_FAIL,
        null,
        "该手机号已被使用，请重新填写！"
      );
      return;
    }
    const userInfo = UserModel.create(registerParams);
    ctx.body = createRes(
      $SuccessCode,
      {
        status: "success",
      },
      ""
    );
  } catch (err) {
    ctx.body = createRes(
      $ErrorCode.Common.SERVER_ERROR,
      null,
      $ErrorMessage.Common.SERVER_ERROR
    );
  }
};

export const searchUser = async (ctx: Context) => {
  // 模糊查询用户
  const { keyWord, currUserId } = ctx.request.body as any;
  const regex = new RegExp(keyWord, "i");
  try {
    const userList = await UserModel.find(
      {
        $or: [{ nickname: regex }, { username: regex }],
      },
      null,
      { lean: true }
    );
    const newUserList = await Promise.all(
      userList.map(async (userInfo: any) => {
        const existfriend = await FriendsModel.findOne({
          $or: [
            { userId: userInfo._id.toString(), friendId: currUserId },
            { friendId: userInfo._id.toString(), userId: currUserId },
          ],
        });
        userInfo.isFriend = existfriend;
        return userInfo;
      })
    );
    ctx.body = createRes(
      $SuccessCode,
      {
        count: keyWord ? userList.length : 0,
        userList: keyWord ? newUserList : [],
      },
      ""
    );
  } catch (err) {
    ctx.body = createRes(
      $ErrorCode.Common.SERVER_ERROR,
      null,
      $ErrorMessage.Common.SERVER_ERROR
    );
  }
};

export const loadUserInfo = async (ctx: Context) => {
  // 查询用户信息
  const { userId } = ctx.request.body as LoadUserInfoParams;
  try {
    const userInfo = await UserModel.findOne(
      {
        _id: userId,
      },
      {
        password: 0,
        __v: 0,
      },
      {
        lean: true,
      }
    );
    ctx.body = createRes($SuccessCode, userInfo, "");
  } catch (err) {
    console.log(err);
    ctx.body = createRes(
      $ErrorCode.Common.SERVER_ERROR,
      null,
      $ErrorMessage.Common.SERVER_ERROR
    );
  }
};

export const addFriend = async (ctx: Context) => {
  // 添加好友
  const { userId, friendId } = ctx.request.body as any;
  try {
    const filter = {
      $or: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    };
    const relationship = await FriendNotificationModel.findOne(filter);
    if (relationship) {
      if (relationship.status == ApplyStatusEnum.APPLYING) {
        ctx.body = createRes(
          $SuccessCode,
          {
            status: "success",
            message: "已申请添加好友，请等待申请通过",
          },
          ""
        );
      } else if (relationship.status == ApplyStatusEnum.REJECTED) {
        await FriendNotificationModel.updateOne(filter, {
          status: 0,
          applyTime: new Date(),
        });
        ctx.body = createRes(
          $SuccessCode,
          {
            status: "success",
            message: "申请成功",
          },
          ""
        );
      }
    } else {
      await FriendNotificationModel.create({ userId, friendId, status: 0 });
      ctx.body = createRes(
        $SuccessCode,
        {
          status: "success",
          message: "申请成功",
        },
        ""
      );
    }
  } catch (err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.Common.SERVER_ERROR, null, err);
  }
};

export const loadFriendList = async (ctx: Context) => {
  // 查询好友列表
  const { userId } = ctx.request.body as FriendNotificationsParams;
  try {
    const friendList = await FriendsModel.find(
      { $or: [{ friendId: userId }, { userId }] },
      null,
      { lean: true }
    )
      .populate({
        path: "userId",
        model: "Users",
        select: ["nickname", "username", "avatarImage"],
      })
      .populate({
        path: "friendId",
        model: "Users",
        select: ["nickname", "username", "avatarImage"],
      });

    ctx.body = createRes(
      $SuccessCode,
      {
        friendList: friendList.map((item) => {
          const { friendId: friendInfo, userId: userInfo, ...rest } = item;
          const info =
            userInfo!._id.toString() == userId ? friendInfo : userInfo;
          return {
            ...rest,
            friendInfo: info,
          };
        }),
      },
      ""
    );
  } catch (err) {
    console.log(err);
    ctx.body = createRes(
      $ErrorCode.Common.SERVER_ERROR,
      null,
      $ErrorMessage.Common.SERVER_ERROR
    );
  }
};

// 聊天栏查询 好友（用户昵称/用户名）群聊（群成员昵称/用户名）聊天记录
export const searchFriendList = async (ctx: Context) => {
  const { userId, keyword } = ctx.request.body as SearchListParams;
  try {
    const regex = new RegExp(keyword, "i");
    const userList = await UserModel.find(
      {
        _id: { $ne: userId },
        $or: [{ nickname: regex }, { username: regex }],
      },
      { username: 1, nickname: 1, avatarImage: 1 },
      { lean: true }
    );
    const result: any[] = [];
    for (let i = 0; i < userList.length; i++) {
      const friend = await FriendsModel.findOne(
        {
          $or: [
            { friendId: userId, userId: userList[i]._id },
            { userId, friendId: userList[i]._id },
          ],
        },
        null,
        { lean: true }
      );
      if (friend) result.push(userList[i]);
    }
    ctx.body = createRes($SuccessCode, result, "");
  } catch (err) {
    console.log(err);
    ctx.body = createRes(
      $ErrorCode.Common.SERVER_ERROR,
      null,
      $ErrorMessage.Common.SERVER_ERROR
    );
  }
};

export const changetFriendStatus = async (ctx: Context) => {
  // 同意/拒绝好友申请
  const { id, changeStatus } = ctx.request.body as FriendStatusChangeParams;
  try {
    const relationship = await FriendNotificationModel.findOneAndUpdate(
      { _id: id },
      { status: changeStatus },
      { lean: true }
    );
    if (changeStatus === ApplyStatusEnum.ACCEPT) {
      await FriendsModel.create({
        userId: relationship?.userId.toString(),
        friendId: relationship?.friendId.toString(),
      });
    }
    ctx.body = createRes(
      $SuccessCode,
      {
        status: "success",
        relationship: {
          ...relationship,
        },
      },
      ""
    );
  } catch (err) {
    console.log(err);
    ctx.body = createRes(
      $ErrorCode.Common.SERVER_ERROR,
      null,
      $ErrorMessage.Common.SERVER_ERROR
    );
  }
};

export const deleteFriend = async (ctx: Context) => {
  const { userId, friendId } = ctx.request.body as DeleteFriendParams;
  try {
    await FriendsModel.deleteOne({
      $or: [
        // 删除好友关系
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    });
    ctx.body = createRes($SuccessCode, { status: "success" }, "");
  } catch (err) {
    console.log(err);
    ctx.body = createRes(
      $ErrorCode.Common.SERVER_ERROR,
      null,
      $ErrorMessage.Common.SERVER_ERROR
    );
  }
};

export const socket_findOneUser = async (userId: string) => {
  const userInfo = await UserModel.findOne({ _id: userId });
  return userInfo;
};
