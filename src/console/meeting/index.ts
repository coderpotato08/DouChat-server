import chalk from "chalk";
import { MeetingDocument } from "../../models/meetingModel";
import { UserDocument } from "../../models/usersModel";
import { logTime } from "../../utils/log-utils";
import Log from "..";

export default class MeetingLog {
  private logInstance;
  constructor(logInstance: Log) {
    this.logInstance = logInstance;
  }

  public create = (  creator: UserDocument, meetingInfo: MeetingDocument) => {
    const { nickname } = creator;
    const { meetingName } = meetingInfo;
    this.logInstance.consoleArgs = [
      ...this.logInstance.consoleArgs,
      `${chalk.green.bold(` 用户 ${nickname} 创建了会议:${meetingName} `)}`,
    ]
    return this.logInstance;
  }
}
