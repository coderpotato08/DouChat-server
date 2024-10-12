import chalk from "chalk";
import dayjs from "dayjs";

export enum LogGenerateType {
  ONLINE_USER = "online-user",
  ONLINE_USER_QUIT = "online-user-quit",
}
const logUtil = (type: LogGenerateType): Function => {
  switch (type) {
    case LogGenerateType.ONLINE_USER:
      return logOnlineUserInfo;
    default:
      return () => {};
  }
};
const logTime = () => {
  const time = dayjs().format("HH:mm:ss");
  return `[ ${chalk.blue.bold(time)} ]`;
};
// 用户进入/退出聊天室app输出日志
export const logOnlineUserInfo = (
  user: any,
  num: Number,
  type: "login" | "quit"
) => {
  const { nickname } = user;
  const joinColor = type === "login" ? chalk.green : chalk.yellow;
  const numColor = type === "login" ? chalk.bgGreen : chalk.bgRed;
  console.log(
    logTime(),
    "[" + joinColor.bold(` user ${nickname} has ${type} `) + "]",
    "online user number：",
    numColor.bold(num)
  );
};

export default logUtil;
