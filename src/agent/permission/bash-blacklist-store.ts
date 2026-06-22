import { AsyncLocalStorage } from "node:async_hooks";
import { BashCmdPattern } from "./bash-cmd-patterns";

// 单条黑名单命中记录，既保存用于再次匹配的正则，也保存给模型和用户看的模板摘要。
type SessionBashBlacklistEntry = {
  pattern: RegExp;
  template: string;
  description?: string;
  hits: number;
  lastCommand: string;
};

// 单个会话的黑名单状态。
// entries 负责记住“哪些高危模板已经被系统判死刑”，
// blockCount 负责统计总触发次数，达到阈值后直接收回 run_bash 能力。
type SessionBashBlacklistState = {
  entries: Map<string, SessionBashBlacklistEntry>;
  blockCount: number;
  bashRevoked: boolean;
};

const BASH_REVOKE_THRESHOLD = 2;

/**
 * 会话级 bash 高危命令黑名单。
 *
 * 设计目标：
 * 1. 首次命中高危命令时，记住这条“命令模板”，避免模型在同一轮会话里反复试探。
 * 2. 在下次 run_bash 真正执行前，先做黑名单预校验，尽量把重试截断在工具层之前。
 * 3. 把当前黑名单摘要注入 system prompt，让模型从上下文层知道哪些命令已经被永久禁止。
 *
 * 这里不用把 sessionId 显式层层透传到每个权限函数，而是借助 AsyncLocalStorage
 * 绑定“当前请求正在处理哪个会话”，这样 permission 模块内部就能按当前会话读写黑名单。
 */
class BashBlacklistStore {
  // 记录“当前异步调用链属于哪个 sessionId”。
  private readonly context = new AsyncLocalStorage<{ sessionId: string }>();

  // 真正的会话态内存存储。key 是 sessionId，value 是本轮会话累计出来的高危命令状态。
  private readonly sessions = new Map<string, SessionBashBlacklistState>();

  // 在请求入口包裹一次，后续同一条异步链中的 permission 检查都能拿到 sessionId。
  public runWithSession<T>(sessionId: string, task: () => T): T {
    return this.context.run({ sessionId }, task);
  }

  // 首次强制禁止命中时调用：把危险命令按模板写入当前会话黑名单，并累计触发次数。
  public rememberBlockedPattern(pattern: BashCmdPattern, command: string): void {
    const sessionId = this.getCurrentSessionId();
    if (!sessionId) {
      return;
    }

    const state = this.getOrCreateState(sessionId);
    const key = pattern.template || pattern.cmd.source;
    const entry = state.entries.get(key);

    if (entry) {
      entry.hits += 1;
      entry.lastCommand = command;
    } else {
      state.entries.set(key, {
        pattern: pattern.cmd,
        template: key,
        description: pattern.description,
        hits: 1,
        lastCommand: command,
      });
    }

    state.blockCount += 1;
    state.bashRevoked = state.blockCount >= BASH_REVOKE_THRESHOLD;
  }

  // run_bash 下发前的二次拦截入口。
  // 如果命中会话黑名单，就直接返回拒绝信息，让上游在工具真正执行前终止这次调用。
  public getPreflightBlockMessage(command: string): string {
    const sessionId = this.getCurrentSessionId();
    if (!sessionId) {
      return "";
    }

    const state = this.sessions.get(sessionId);
    if (!state) {
      return "";
    }

    if (state.bashRevoked) {
      return "【会话限制】由于本轮会话已多次触发【强制禁止】bash 高危命令，run_bash 工具权限已被临时收回。请改用其他安全工具完成任务。";
    }

    const matchedEntry = Array.from(state.entries.values()).find((entry) => entry.pattern.test(command));
    if (!matchedEntry) {
      return "";
    }

    matchedEntry.hits += 1;
    matchedEntry.lastCommand = command;
    state.blockCount += 1;
    state.bashRevoked = state.blockCount >= BASH_REVOKE_THRESHOLD;

    if (state.bashRevoked) {
      return `【会话限制】当前 bash 命令命中本轮会话黑名单模板：${matchedEntry.template}。由于已多次触发黑名单，run_bash 工具权限现已被临时收回。`;
    }

    return `【会话限制】当前 bash 命令命中本轮会话黑名单模板：${matchedEntry.template}。该类高危命令已被系统记录，请勿再次生成同类 run_bash 调用。`;
  }

  // 把当前会话已经记录下来的黑名单摘要格式化成 prompt 片段，注入给模型作为硬约束。
  public buildSystemPromptConstraint(sessionId: string): string {
    const state = this.sessions.get(sessionId);
    const lines = [
      "会话内所有被系统标记为【强制禁止】的 bash 高危命令，会存入本次会话黑名单；你必须严格规避黑名单内所有命令模板，不得再次生成同类 run_bash 调用；若多次触发黑名单，本次 bash 工具权限将被临时收回。",
    ];

    if (!state || state.entries.size === 0) {
      lines.push("当前会话 bash 黑名单：暂无已记录的高危命令模板。");
      return lines.join("\n");
    }

    lines.push("当前会话 bash 黑名单模板：");
    for (const entry of state.entries.values()) {
      const description = entry.description ? `：${entry.description}` : "";
      lines.push(`- ${entry.template}${description}`);
    }

    if (state.bashRevoked) {
      lines.push("当前会话 run_bash 工具权限状态：已临时收回。");
    }

    return lines.join("\n");
  }

  // 读取当前异步上下文绑定的 sessionId；没有上下文时，说明当前调用不处于受控会话内。
  private getCurrentSessionId(): string | undefined {
    return this.context.getStore()?.sessionId;
  }

  // 懒初始化会话状态，避免在每次请求开始时预创建无用黑名单容器。
  private getOrCreateState(sessionId: string): SessionBashBlacklistState {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing;
    }

    const created: SessionBashBlacklistState = {
      entries: new Map(),
      blockCount: 0,
      bashRevoked: false,
    };
    this.sessions.set(sessionId, created);
    return created;
  }
}

export const bashBlacklistStore = new BashBlacklistStore();
