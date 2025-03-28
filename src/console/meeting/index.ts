import chalk from "chalk";
import { MeetingDocument } from "../../models/meetingModel";
import { UserDocument } from "../../models/usersModel";
import BaseLog, { ArgTypeEnum } from "../base";

export default class MeetingLog extends BaseLog {
  public create = (creator: UserDocument, meetingInfo: MeetingDocument) => {
    const { nickname } = creator;
    const { meetingName } = meetingInfo;
    this.consoleArgs = [
      ...this.consoleArgs,
      [
        ArgTypeEnum.TEXT,
        `${chalk.green.bold(` 用户 ${nickname} 创建了会议:${meetingName} `)}`,
      ],
    ];
    return this;
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
    this.consoleArgs = [
      ...this.consoleArgs,
      [ArgTypeEnum.TEXT, `[${chalk.blue.bold(getType)}]`],
      [
        ArgTypeEnum.TEXT,
        `meetingId: ${chalk.green.bold(meetingId)} from:${chalk.green.bold(
          from
        )} => to:${chalk.green.bold(to)}`,
      ],
    ];
    return this;
  };
}
