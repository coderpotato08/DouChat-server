import MeetingLog from "./meeting";
import UserLog from "./user";

export default class Log {
  public user: () => UserLog;
  public meeting: () => MeetingLog;

  constructor() {
    this.user = () => new UserLog();
    this.meeting = () => new MeetingLog();
  }
}