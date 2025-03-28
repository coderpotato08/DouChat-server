import MeetingModel from "../models/meetingModel";
import UsersModel, { UserDocument } from "../models/usersModel";
import { v4 } from "uuid";
import { createRes } from "../models/responseModel";
import { $SuccessCode, $ErrorCode, $ErrorMessage } from "../constant/errorData";
import { Context } from "koa";
import Log from "../console";

export const createMeeting = async (ctx: Context) => {
  const log = new Log();
  try {
    const { creator, meetingName, userList, isJoinedMuted, createTime } = ctx
      .request.body as any;
    if (!userList || userList.length <= 0) {
      ctx.body = createRes(
        $ErrorCode.Meeting.USER_LIST_EMPTY,
        null,
        $ErrorMessage.Meeting.USER_LIST_EMPTY
      );
    }
    const meetingId = v4();
    const creatorInfo = await UsersModel.findById(creator);
    const createMeetingInfo = await MeetingModel.create({
      meetingId,
      creator,
      meetingName,
      userList,
      isJoinedMuted,
      createTime,
    });
    // log create meeting
    log.meeting()
      .create(creatorInfo as UserDocument, createMeetingInfo)
      .time(createTime)
      .printLog();
    ctx.body = createRes(
      $SuccessCode,
      {
        meetingId,
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

export const loadMeetingInfo = async (ctx: Context) => {
  try {
    const { meetingId } = ctx.request.body as any;
    const meetingInfo = await MeetingModel.findOne({ meetingId })
      .populate({
        path: "creator",
        model: "Users",
        select: ["username", "nickname", "_id", "avatarImage"],
      })
      .populate({
        path: "userList",
        model: "Users",
        select: ["username", "nickname", "_id", "avatarImage"],
      });
    ctx.body = createRes($SuccessCode, meetingInfo || null, "");
  } catch (err) {
    ctx.body = createRes(
      $ErrorCode.Common.SERVER_ERROR,
      null,
      $ErrorMessage.Common.SERVER_ERROR
    );
  }
};

export const updateMeetingEndTime = async (meetingId: string) => {
  const res = await MeetingModel.updateOne(
    { meetingId },
    { endTime: new Date() }
  );
  return !!res.modifiedCount;
};
