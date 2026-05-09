import AgentLog from "./agent";
import BaseLog, { ConsoleArg } from "./base";
import MeetingLog from "./meeting";
import UserLog from "./user";

/**
 * 共享日志入口本身不持有可变状态，只负责派生新的日志链。
 * 因此应用层可以只初始化一次并全局复用。
 */
export class Log extends BaseLog {
  public agent: () => AgentLog;
  public user: () => UserLog;
  public meeting: () => MeetingLog;

  constructor(consoleArgs: ConsoleArg[] = []) {
    super(consoleArgs);
    // 领域日志复用当前链快照继续派生，避免与其他链共享内部状态。
    this.agent = () => new AgentLog(this.consoleArgs);
    this.user = () => new UserLog(this.consoleArgs);
    this.meeting = () => new MeetingLog(this.consoleArgs);
  }
}

// 命名导出共享入口，业务代码直接从这里开始一条新链即可。
export const SystemLogger = new Log();
