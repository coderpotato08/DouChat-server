import chalk from "chalk";
import { UserDocument } from "../../models/usersModel";
import Log from "../index";

export default class UserLog {
  private logInstance;
  constructor(logInstance: Log) {
    this.logInstance = logInstance;
  }

  public login = (user: UserDocument, num: number) => {
    const { nickname } = user;
    this.logInstance.consoleArgs = [
      ...this.logInstance.consoleArgs,
      "[" + chalk.green.bold(` 用户 ${nickname} 已登录`) + "]",
      "当前在线用户数量：",
      chalk.bgGreen.bold(num),
    ];
    return this.logInstance;
  };

  public logout = (user: UserDocument, num: number) => {
    const { nickname } = user;
    this.logInstance.consoleArgs = [
      ...this.logInstance.consoleArgs,
      "[" + chalk.yellow.bold(` 用户 ${nickname} 已退出`) + "]",
      "当前在线用户数量：",
      chalk.bgRed.bold(num),
    ];
    return this.logInstance;
  };
}
