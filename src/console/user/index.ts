import chalk from "chalk";
import { UserDocument } from "../../models/usersModel";
import BaseLog, { ArgTypeEnum, ConsoleArg } from "../base";

export default class UserLog extends BaseLog {
  constructor(consoleArgs: ConsoleArg[] = []) {
    super(consoleArgs);
  }

  public login = (user: UserDocument, num: number) => {
    const { nickname } = user;
    return this.appendArgs(
      [ArgTypeEnum.TEXT, "[" + chalk.green.bold(` 用户 ${nickname} 已登录 `) + "]"],
      [ArgTypeEnum.TEXT, "当前在线用户数量："],
      [ArgTypeEnum.TEXT, chalk.bgGreen.bold(num)]
    );
  };

  public logout = (user: UserDocument, num: number) => {
    const { nickname } = user;
    return this.appendArgs(
      [ArgTypeEnum.TEXT, "[" + chalk.yellow.bold(` 用户 ${nickname} 已退出 `) + "]"],
      [ArgTypeEnum.TEXT, "当前在线用户数量："],
      [ArgTypeEnum.TEXT, chalk.bgRed.bold(num)]
    );
  };
}
