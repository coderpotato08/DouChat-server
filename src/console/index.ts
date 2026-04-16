import BaseLog, { ConsoleArg } from "./base";
import MeetingLog from "./meeting";
import UserLog from "./user";

/**
 * 控制台日志工具链
 * 支持链式调用，输出时间和基本状态
 *
 */
export class Log extends BaseLog {
  public user: () => UserLog;
  public meeting: () => MeetingLog;

  constructor(consoleArgs: ConsoleArg[] = []) {
    super(consoleArgs);
    this.user = () => new UserLog(this.consoleArgs);
    this.meeting = () => new MeetingLog(this.consoleArgs);
  }
}

const log = new Log();

export default log;
