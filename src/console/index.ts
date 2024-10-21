import BaseLog from "./base";
import MeetingLog from "./meeting";
import UserLog from "./user";

export default class Log extends BaseLog {
  public user: () => UserLog;
  public meeting: () => MeetingLog;

  constructor() {
    super();
    this.user = () => new UserLog();
    this.meeting = () => new MeetingLog();
  }
}