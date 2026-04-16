import chalk from "chalk";
import { MeetingDocument } from "../../models/meetingModel";
import { UserDocument } from "../../models/usersModel";
import BaseLog, { ArgTypeEnum, ConsoleArg } from "../base";

export default class MeetingLog extends BaseLog {
  constructor(consoleArgs: ConsoleArg[] = []) {
    super(consoleArgs);
  }

  public create = (creator: UserDocument, meetingInfo: MeetingDocument) => {
    const { nickname } = creator;
    const { meetingName } = meetingInfo;
    return this.appendArgs([
      ArgTypeEnum.TEXT,
      `${chalk.green.bold(` 用户 ${nickname} 创建了会议:${meetingName} `)}`,
    ]);
  };

  public sdp = (
    type: "offer" | "answer",
    params: {
      peerId: string;
      meetingId: string;
      from: string;
      to: string;
    }
  ) => {
    const { meetingId, from, to } = params;
    const getType = type === "offer" ? "get offer" : "send answer";
    return this.appendArgs(
      [ArgTypeEnum.TEXT, `[${chalk.blue.bold(getType)}]`],
      [
        ArgTypeEnum.TEXT,
        `meetingId: ${chalk.green.bold(meetingId)} from:${chalk.green.bold(from)} => to:${chalk.green.bold(
          to
        )}`,
      ]
    );
  };
}
