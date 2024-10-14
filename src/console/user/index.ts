import chalk from "chalk";
import { UserDocument } from "../../models/usersModel";
import BaseLog, { ArgTypeEnum } from "../base";

export default class UserLog extends BaseLog {
  public login = (user: UserDocument, num: number) => {
    const { nickname } = user;
    this.consoleArgs = [
      ...this.consoleArgs,
      [
        ArgTypeEnum.TEXT,
        "[" + chalk.green.bold(` 用户 ${nickname} 已登录 `) + "]",
      ],
      [ArgTypeEnum.TEXT, "当前在线用户数量："],
      [ArgTypeEnum.TEXT, chalk.bgGreen.bold(num)],
    ];
    return this;
  };

  public logout = (user: UserDocument, num: number) => {
    const { nickname } = user;
    this.consoleArgs = [
      ...this.consoleArgs,
      [
        ArgTypeEnum.TEXT,
        "[" + chalk.yellow.bold(` 用户 ${nickname} 已退出 `) + "]",
      ],
      [ArgTypeEnum.TEXT, "当前在线用户数量："],
      [ArgTypeEnum.TEXT, chalk.bgRed.bold(num)],
    ];
    return this;
  };
}
