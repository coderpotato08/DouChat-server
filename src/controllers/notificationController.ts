import { Context } from "koa";
import FriendNotificationModel from "../models/friendNotificationModel";
import GroupNotificationModel from "../models/groupNotificationModel";
import { 
  DeleteFriendNotificationParams,
  DeleteGroupNotificationParams, 
  FriendNotificationsParams, 
  LoadGroupNotificationsParams, 
} from "../constant/apiTypes";
import { $ErrorCode, $ErrorMessage, $SuccessCode } from "../constant/errorData";
import { createRes } from "../models/responseModel";

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