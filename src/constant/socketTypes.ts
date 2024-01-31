export enum EventType {
  CREATE_MEETING = "create-meeting", // 创建会议
  INVITE_MEETING = "meeting-invite",  // 会议邀请
  RECEIVE_INVITE = "receive-invite", // 接受会议邀请
  REJECT_INVITE = "reject-invite", // 拒绝会议邀请
  JOIN_MEETING = "join-meeting",  // 加入会议
  JOINED_MEETING = "joined-meeting",  // 加入会议成功
  DEVICE_STATUS_CHANGE = "device-status-change",  // 设备状态改变
  END_MEETING = "end-meeting",  // 结束会议
  LEAVE_MEETING = "leave-meeting", // 退出会议
  SEND_OFFER = "send-offer",  // 发送sdp
  ANSWER_OFFER = "answer-offer",  // 响应sdp
  ICE_CANDIDATE = "ice_candidate",  // 发送ICE到其他客户端
  JOIN_SUCCESS = "join-success",
  ADD_USER = "add-user",
  SEND_MESSAGE = "send-message",
  RECEIVE_MESSAGE = "receive-message",
  READ_MESSAGE = "read-message",
}