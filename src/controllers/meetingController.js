const MeetingModel = require("../models/meetingModel");
const uuid = require('uuid');
const { createRes } = require("../models/responseModel");
const { $SuccessCode, $ErrorCode, $ErrorMessage } = require("../constant/errorData");

const createMeeting = async (ctx) => {
  try {
    const { request } = ctx;
    const { creator, meetingName, userList, isJoinedMuted, createTime } = request.body;
    if(!userList || userList.length <= 0) {
      ctx.body = createRes($ErrorCode.USER_LIST_EMPTY, null, $ErrorMessage.USER_LIST_EMPTY)
    }
    const meetingId = uuid.v4();
    const createMeetingInfo = await MeetingModel.create({
      meetingId,
      creator,
      meetingName,
      userList,
      isJoinedMuted,
      createTime,
    })
    ctx.body = createRes($SuccessCode, {
      meetingId,
      status: 'success'
    }, "");
  } catch(err) {
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

const loadMeetingInfo = async (ctx) => {
  try {
    const { request } = ctx;
    const { meetingId } = request.body;
    const meetingInfo = await MeetingModel
      .findOne({ meetingId })
      .populate({
        path: 'creator',
        module: "Users",
        select: ["username", "nickname", "_id", "avatarImage"],
      })
      .populate({
        path: 'userList',
        module: "Users",
        select: ["username", "nickname", "_id", "avatarImage"],
      });
    ctx.body = createRes($SuccessCode, meetingInfo || null, "")
  } catch(err) {
    ctx.body = createRes($ErrorCode.SERVER_ERROR, null, $ErrorMessage.SERVER_ERROR)
  }
}

const updateMeetingEndTime = async (meetingId) => {
  const res = await MeetingModel.updateOne({meetingId}, {endTime: new Date()});
  return !!res.modifiedCount
}

module.exports = {
  createMeeting,
  loadMeetingInfo,
  updateMeetingEndTime
}
