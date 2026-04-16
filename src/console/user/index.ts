import chalk from "chalk";
import { UserDocument } from "../../models/usersModel";
import BaseLog, { ArgTypeEnum, ConsoleArg } from "../base";

export default class UserLog extends BaseLog {
  constructor(consoleArgs: ConsoleArg[] = []) {
    super(consoleArgs);
  }

  /** 用户域日志只追加自己的正文片段，链状态仍由 BaseLog 统一管理。 */
  public login = (user: UserDocument, num: number) => {
    const { nickname } = user;
    return this.appendArgs(
      [ArgTypeEnum.TEXT, "[" + chalk.green.bold(` 用户 ${nickname} 已登录 `) + "]"],
      [ArgTypeEnum.TEXT, "当前在线用户数量："],
      [ArgTypeEnum.TEXT, chalk.bgGreen.bold(num)]
    );
  };

  /** 用户域链与基础链隔离，可安全复用共享 logger 入口。 */
  public logout = (user: UserDocument, num: number) => {
    const { nickname } = user;
    return this.appendArgs(
      [ArgTypeEnum.TEXT, "[" + chalk.yellow.bold(` 用户 ${nickname} 已退出 `) + "]"],
      [ArgTypeEnum.TEXT, "当前在线用户数量："],
      [ArgTypeEnum.TEXT, chalk.bgRed.bold(num)]
    );
  };
}
