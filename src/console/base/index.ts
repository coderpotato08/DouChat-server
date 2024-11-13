import chalk, { Chalk } from "chalk";
import dayjs from "dayjs";

export enum ArgTypeEnum {
  STATUS,
  TIME,
  TEXT = 99,
}
export default class BaseLog {
  public consoleArgs: [ArgTypeEnum, any][] = [];

  public error = () => {
    this.consoleArgs.unshift([
      ArgTypeEnum.STATUS,
      `[ ${chalk.red.bold("[ ERROR ]")} ]`
    ]);
    return this;
  }

  public success = () => {
    this.consoleArgs.unshift([
      ArgTypeEnum.STATUS, 
      `[ ${chalk.green.bold("SUCCESS")} ]`
    ]);
    return this;
  }

  public warning = () => {
    this.consoleArgs.unshift([
      ArgTypeEnum.STATUS, 
      `[ ${chalk.yellow.bold("WARNING")} ]`
    ]);
    return this;
  }

  public info = () => {
    this.consoleArgs.unshift([
      ArgTypeEnum.STATUS, 
      `[ ${chalk.yellow.bold("INFO")} ]`
    ]);
    return this;
  }

  public time = (time?: Date | string) => {
    const defaultTime = dayjs(time || new Date()).format("HH:mm:ss");
    this.consoleArgs.push([
      ArgTypeEnum.TIME, 
      `[ ${chalk.blue.bold(defaultTime)} ]`
    ]);
    return this;
  }

  public printLog = (str?: Chalk | string) => {
    const args = this.consoleArgs
      .sort((a, b) => a[0] - b[0])
      .map((arg) => arg[1]);
    if(str) {
      args.push(str);
    }
    console.log(...args);
  }
}