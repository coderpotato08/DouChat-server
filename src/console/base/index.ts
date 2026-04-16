import chalk from "chalk";
import dayjs from "dayjs";

export enum ArgTypeEnum {
  STATUS,
  TIME,
  TEXT = 99,
}

export type ConsoleArg = readonly [ArgTypeEnum, unknown];

export default class BaseLog {
  protected readonly consoleArgs: ConsoleArg[];

  constructor(consoleArgs: ConsoleArg[] = []) {
    this.consoleArgs = consoleArgs;
  }

  protected next(nextArgs: ConsoleArg[]): this {
    const CurrentLog = this.constructor as new (consoleArgs?: ConsoleArg[]) => this;
    return new CurrentLog(nextArgs);
  }

  protected appendArgs(...args: ConsoleArg[]): this {
    return this.next([...this.consoleArgs, ...args]);
  }

  protected prependArgs(...args: ConsoleArg[]): this {
    return this.next([...args, ...this.consoleArgs]);
  }

  public error = () => {
    return this.prependArgs([ArgTypeEnum.STATUS, `[ ${chalk.red.bold("[ ERROR ]")} ]`]);
  };

  public success = () => {
    return this.prependArgs([ArgTypeEnum.STATUS, `[ ${chalk.green.bold("SUCCESS")} ]`]);
  };

  public warning = () => {
    return this.prependArgs([ArgTypeEnum.STATUS, `[ ${chalk.yellow.bold("WARNING")} ]`]);
  };

  public info = () => {
    return this.prependArgs([ArgTypeEnum.STATUS, `[ ${chalk.yellow.bold("INFO")} ]`]);
  };

  public time = (time?: Date | string) => {
    const defaultTime = dayjs(time || new Date()).format("HH:mm:ss");
    return this.appendArgs([ArgTypeEnum.TIME, `[ ${chalk.blue.bold(defaultTime)} ]`]);
  };

  public printLog = (str?: unknown) => {
    const args = [...this.consoleArgs].sort((a, b) => a[0] - b[0]).map((arg) => arg[1]);
    if (str) {
      args.push(str);
    }
    console.log(...args);
  };
}
