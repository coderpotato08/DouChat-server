import { Context } from "koa";
import GroupModel from "../models/groupsModel";
import GroupUserModel from "../models/groupUserModel";
import { CreateGroupParams, LoadGroupListParams, LoadGroupUsersParams } from "../constant/apiTypes";
import { createRes } from "../models/responseModel";
import { $ErrorCode, $ErrorMessage, $SuccessCode } from "../constant/errorData";

export const createGroup = async (ctx: Context) => {
  const { groupName, groupNumber, creator, users, sign} = (ctx.request.body as CreateGroupParams);
  try {
    const group = await GroupModel.findOne({ groupNumber });
    if (!group) {
      const groupInfo = await GroupModel.create({
        creator,
        groupName,
        groupNumber,
        sign,
      });
      const groupUsersList = [...users, creator].map((userId) => ({
        userId,
        groupId: groupInfo._id,
        state: 1,
        time: new Date(),
      }));
      await GroupUserModel.create(groupUsersList);
      ctx.body = createRes($SuccessCode, {
        groupId: groupInfo._id,
        status: "success"
      }, "")
    } else {
      ctx.body = createRes($ErrorCode.GROUP_NUMBER_EXIST, null, $ErrorMessage.GROUP_NUMBER_EXIST)
    }
  } catch(err) {
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, err)
  }
}

export const loadGroupList = async (ctx: Context) => {
  const { userId } = (ctx.request.body as LoadGroupListParams);
  try {
    const groupList = await GroupUserModel
      .find({ userId, status: 1 }, null, { lean: true })
      .populate({
        path: "userId",
        model: "Users",
        select: ["nickname", "username", "avatarImage"],
      })
      .populate({
        path: "groupId",
        model: "groups",
        populate: {
          path: "creator",
          model: "Users",
          select: ["nickname", "username", "avatarImage"]
        }
      })
    const newGroupList = await Promise.all(groupList.map(async (group) => { // 处理成员头像，客户端组成群聊icon
      const { userId, groupId, ...rest} = group
      const usersList = await GroupUserModel
        .find({ groupId, status: 1 }, { userId: 1 }, { lean: true })
        .populate({
          path: "userId",
          model: "Users",
          select: ["username", "avatarImage"],
        })
        .sort({time: 1})
        .limit(4)
      return {
        ...rest,
        userInfo: userId,
        groupInfo: {
          ...groupId, 
          usersAvaterList: usersList.map((item: any) => item.userId?.avatarImage)
        },
      }
    }))
    ctx.body = createRes($SuccessCode, newGroupList, "");
  } catch(err) {
    console.log(err)
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, err)
  }
}

export const loadGroupUsers = async (ctx: Context) => {
  const { groupId } = (ctx.request.body as LoadGroupUsersParams);
  try {
    const userList = await GroupUserModel
      .find({groupId, state: 1}, {userId: 1}, {lean: true})
      .populate({
        path: "userId",
        model: "Users",
        select: ["nickname", "username", "avatarImage"],
      })
    ctx.body = createRes($SuccessCode, userList.map((item) => item.userId), "")
  } catch (err) {
    console.log(err)
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, err)
  }
}