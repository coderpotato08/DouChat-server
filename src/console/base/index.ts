import chalk from "chalk";
import dayjs from "dayjs";

export enum ArgTypeEnum {
  STATUS,
  TIME,
  TEXT = 99,
}

export type ConsoleArg = readonly [ArgTypeEnum, unknown];

/**
 * BaseLog 采用不可变链设计：每次链式调用都返回一个带新快照的实例，
 * 不直接修改当前对象，这样共享入口实例也不会产生状态污染。
 */
export default class BaseLog {
  protected readonly consoleArgs: ConsoleArg[];

  constructor(consoleArgs: ConsoleArg[] = []) {
    this.consoleArgs = consoleArgs;
  }

  /**
   * 基于当前运行时子类派生下一条日志链，确保 UserLog / MeetingLog
   * 在链式调用过程中不会退化成 BaseLog。
   */
  protected next(nextArgs: ConsoleArg[]): this {
    const CurrentLog = this.constructor as new (consoleArgs?: ConsoleArg[]) => this;
    return new CurrentLog(nextArgs);
  }

  /** 追加片段到当前链尾部，常用于正文类日志片段。 */
  protected appendArgs(...args: ConsoleArg[]): this {
    return this.next([...this.consoleArgs, ...args]);
  }

  /** 插入片段到当前链头部，常用于状态标签等前缀信息。 */
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
    return this.prependArgs([ArgTypeEnum.STATUS, `[ ${chalk.blue.bold("INFO")} ]`]);
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
