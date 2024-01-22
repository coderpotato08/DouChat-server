import chalk from 'chalk';

export enum LogGenerateType {
  ONLINE_USER = "online-user",
}
const logUtil = (type: LogGenerateType):Function => {
  switch(type) {
    case "online-user":
      return logOnlineUserInfo
    default:
      return () => {};
  }
}
export const logOnlineUserInfo = (addUser: any, num: Number) => {
  const { username, _id } = addUser;
  console.log(
    chalk.bgGreen.bold(`user ${username} has login`), 
    "online user number：",
    chalk.bgGreen.bold(num)
  )
}

export default logUtil;