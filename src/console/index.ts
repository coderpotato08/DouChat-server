import chalk from "chalk";
import MeetingLog from "./meeting";
import UserLog from "./user";
import dayjs from "dayjs";

export default class Log {
  public consoleArgs: any[] = [];
  public user: UserLog;
  public meeting: MeetingLog;

  constructor() {
    this.user = new UserLog(this);
    this.meeting = new MeetingLog(this);
  }

  public error = () => {
    this.consoleArgs.unshift(`[ ${chalk.red.bold("[ ERROR ]")} ]`);
    return this;
  }

  public success = () => {
    this.consoleArgs.unshift(`[ ${chalk.green.bold("SUCCESS")} ]`);
    return this;
  }

  public warning = () => {
    this.consoleArgs.unshift(`[ ${chalk.yellow.bold("WARNING")} ]`);
    return this;
  }

  public time = (time?: Date | string) => {
    const defaultTime = dayjs(time || new Date()).format("HH:mm:ss");
    this.consoleArgs.push(`[ ${chalk.blue.bold(defaultTime)} ]`);
    return this;
  }

  public printLog = () => {
    console.log(...this.consoleArgs);
  }
}