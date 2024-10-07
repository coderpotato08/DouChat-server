import { Context } from "koa";
import GroupModel from "../models/groupsModel";
import GroupUserModel from "../models/groupUserModel";
import GroupNotificationModel from "../models/groupNotificationModel";
import { 
  AddGroupUsersParams,
  CreateGroupParams,
  DisbandGroupParams,
  LoadGroupInfoParams,
  LoadGroupListParams,
  LoadGroupUsersParams,
  QuitGroupParams,
  SearchListParams,
  UpdateGroupInfoParams
} from "../constant/apiTypes";
import { createRes } from "../models/responseModel";
import { $ErrorCode, $ErrorMessage, $SuccessCode } from "../constant/errorData";
import { ApplyStatusEnum } from "../constant/commonTypes";
import { SocketChangeGroupStatusParams } from "../constant/socketTypes";

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
      .find({ userId }, null, { lean: true })
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
        .find({ groupId }, { userId: 1 }, { lean: true })
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

export const loadGroupInfo = async (ctx: Context) => {
  const { groupId } = (ctx.request.body as LoadGroupInfoParams);
  try {
    const info = await GroupModel
      .findOne({_id: groupId}, null, {lean: true})
      .populate({
        path: "creator",
        model: "Users",
        select: ["nickname", "username", "avatarImage"]
      });
    const userList = await GroupUserModel
      .find({groupId}, {userId: 1}, {lean: true})
      .populate({
        path: "userId",
        model: "Users",
        select: ["nickname", "username", "avatarImage"],
      })
    ctx.body = createRes($SuccessCode, {
      ...info,
      usersAvaterList: userList.slice(0, 4).map((item: any) => item.userId.avatarImage),
      userList: userList.map((item) => item.userId),
    }, "")
  } catch(err) {
    console.log(err)
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, err)
  }
}

export const loadGroupUsers = async (ctx: Context) => {
  const { groupId, keyWord = "" } = (ctx.request.body as LoadGroupUsersParams);
  try {
    const userList = await GroupUserModel
      .find({ groupId }, {userId: 1}, {lean: true})
      .populate({
        path: "userId",
        model: "Users",
        match: {
          $or: [
            {nickname: { $regex: keyWord, $options: 'i' }},
            {username: { $regex: keyWord, $options: 'i' }},
          ]
        },
        select: ["nickname", "username", "avatarImage"],
      })
    const result = userList
      .map((item) => item.userId)
      .filter(Boolean)
    ctx.body = createRes($SuccessCode, result, "")
  } catch (err) {
    console.log(err)
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, err)
  }
}

export const inviteGroupUsers = async (ctx: Context) => {
  const { inviterId, groupId, userList } = (ctx.request.body as AddGroupUsersParams);
  try {
    await Promise.all(userList.map(async (id) => {
      const existNote = await GroupNotificationModel.findOne({ inviterId, groupId, userId: id, status: 0});
      // 判断是否有已存在的申请，且状态申请中
      if(existNote) { // 存在就更新时间
        await GroupNotificationModel.updateOne({_id: existNote._id}, {createTime: new Date()})
      } else {  // 不存在新建
        await GroupNotificationModel.create({
          inviterId,
          groupId,
          userId: id,
          status: 0,
          createTime: new Date(),
        })
      }
    }));
    ctx.body = createRes($SuccessCode, { status: "success" }, "")
  } catch (err) {
    console.log(err)
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

export const quitGroup = async (ctx: Context) => {
  const { groupId, userId } = (ctx.request.body as QuitGroupParams);
  try {
    await GroupUserModel.deleteMany({ groupId, userId });
    ctx.body = createRes($SuccessCode, {status: "success"}, "")
  } catch (err) {
    console.log(err)
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, err)
  }
}

export const disbandGroup = async (ctx: Context) => {
  const { groupId } = (ctx.request.body as DisbandGroupParams);
  try {
    await GroupModel.deleteOne({ groupId });
    await GroupUserModel.deleteMany({ groupId });
    ctx.body = createRes($SuccessCode, {status: "success"}, "")
  } catch (err) {
    console.log(err)
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, err)
  }
}

export const updateGroupInfo = async (ctx: Context) => {
  const { groupId, sign, groupName } = (ctx.request.body as UpdateGroupInfoParams);
  try {
    await GroupModel.updateOne({ _id: groupId }, { $set: { sign, groupName }});
    ctx.body = createRes($SuccessCode, { status: "success" }, "");
  } catch(err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, err)
  }
}

export const searchGroupList = async (ctx: Context) => {
  const { userId, keyword } = (ctx.request.body as SearchListParams);
  try {
    const regex = new RegExp(keyword, 'i');

    const groupList = await GroupModel
      .find({}, null, {lean: true});
    const result = [];
    for(let i=0; i<groupList.length; i++) {
      const groupInfo = groupList[i];
      const usersAvaterList = await GroupUserModel
        .find({ groupId: groupInfo._id.toString() }, {userId: 1}, {lean: true})
        .populate({
          path: "userId",
          model: "Users",
          select: ["avatarImage"],
        })
        .limit(4)
      const userList = await GroupUserModel
        .find({ groupId: groupInfo._id.toString() }, {userId: 1}, {lean: true})
        .populate({
          path: "userId",
          model: "Users",
          match: {
            $or: [{username: regex}, {nickname: regex}]
          },
          select: ["nickname", "username", "avatarImage"],
        })
      const filterUserList = userList
        .map((item) => item.userId)
        .filter((item: any) => item && item._id !== userId);
      const isInGroup = !!await GroupUserModel.findOne({userId, groupId: groupInfo._id.toString()}); // 是否在群内
      const isGroupNameMatch = groupInfo.groupName.indexOf(keyword) > -1;
      const isGroupUserMatch = filterUserList.length > 0
      if(isInGroup && (isGroupNameMatch || isGroupUserMatch)) {
        result.push({
          ...groupList[i],
          usersAvaterList: usersAvaterList.map((item: any) => item.userId.avatarImage),
          filterUserList,
        })
      }
    }
    ctx.body = createRes($SuccessCode, result, "");
  } catch(err) {
    console.log(err);
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

export const socket_ChangeGroupNotificationStatus = async (data: SocketChangeGroupStatusParams) => {
  const { id, changeStatus } = data;
  try {
    const groupNote: any = await GroupNotificationModel
      .findOneAndUpdate({ _id: id }, {status: changeStatus})
      .populate({
        path: "userId",
        model: "Users",
        select: ["nickname"],
      })
    if(changeStatus === ApplyStatusEnum.ACCEPT) {
      await GroupUserModel.create({
        groupId: groupNote?.groupId.toString(),
        userId: groupNote?.userId._id.toString(),
      })
    }
    return groupNote || {};
  } catch (err) {
    console.log(err)
  }
}

export const socket_getGroups = async (userId: string) => {
  const groupList = await GroupUserModel.find({ userId }, null, { lean: true });
  return groupList
}