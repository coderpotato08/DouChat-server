import chalk from "chalk";
import dayjs from "dayjs";
import { MeetingDocument } from "../models/meetingModel";
import { UserDocument } from "../models/usersModel";

export enum LogGenerateType {
  ONLINE_USER = "online-user",
  ONLINE_USER_QUIT = "online-user-quit",
  CREATE_MEETING = "create-meeting",
}
const logUtil = (type: LogGenerateType): Function => {
  switch (type) {
    case LogGenerateType.ONLINE_USER:
      return logOnlineUserInfo;
    case LogGenerateType.CREATE_MEETING:
      return logCreateMeetingInfo;
    default:
      return () => {};
  }
};
export const logTime = (time?: Date) => {
  const defaultTime = dayjs(time || new Date()).format("HH:mm:ss");
  return `[ ${chalk.blue.bold(defaultTime)} ]`;
};
// 用户进入/退出聊天室app输出日志
const logOnlineUserInfo = (
  user: any,
  num: Number,
  type: "login" | "quit"
) => {
  const { nickname } = user;
  const joinColor = type === "login" ? chalk.green : chalk.yellow;
  const numColor = type === "login" ? chalk.bgGreen : chalk.bgRed;
  console.log(
    logTime(),
    "[" + joinColor.bold(` 用户 ${nickname} 已${type === "login" ? "登录" : "退出"} `) + "]",
    "当前在线用户数量：",
    numColor.bold(num)
  );
};

// 用户创建会议输出日志
const logCreateMeetingInfo = (
  creator: UserDocument,
  meetingInfo: MeetingDocument, 
) => {
  const { nickname } = creator;
  const { meetingName, createTime } = meetingInfo;
  console.log(
    logTime(createTime),
    `${chalk.green.bold(` 用户 ${nickname} 创建了会议:${meetingName} `)}`,
  );
}

export default logUtil;
