import BaseLog from "./base";
import MeetingLog from "./meeting";
import UserLog from "./user";

/**
 * 控制台日志工具链
 * 支持链式调用，输出时间和基本状态
 * 
 */
export default class Log extends BaseLog {
  public user: () => UserLog;
  public meeting: () => MeetingLog;

  constructor() {
    super();
    this.user = () => new UserLog();
    this.meeting = () => new MeetingLog();
  }
}