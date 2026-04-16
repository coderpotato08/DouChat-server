import chalk from "chalk";
import { MeetingDocument } from "../../models/meetingModel";
import { UserDocument } from "../../models/usersModel";
import BaseLog, { ArgTypeEnum, ConsoleArg } from "../base";

export default class MeetingLog extends BaseLog {
  constructor(consoleArgs: ConsoleArg[] = []) {
    super(consoleArgs);
  }

  /** 会议域方法只负责组织业务文本，不直接操作共享状态。 */
  public create = (creator: UserDocument, meetingInfo: MeetingDocument) => {
    const { nickname } = creator;
    const { meetingName } = meetingInfo;
    return this.appendArgs([
      ArgTypeEnum.TEXT,
      `${chalk.green.bold(` 用户 ${nickname} 创建了会议:${meetingName} `)}`,
    ]);
  };

  /** 会议日志继续沿用当前链快照，支持与基础状态标签自由组合。 */
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
