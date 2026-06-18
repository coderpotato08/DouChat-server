import { v4 as uuidv4 } from "uuid";
import { permissionStore } from "../engine/permission-store";
import { EventHandler } from "../types/agent";

type PermissionRule = {
  tools: string[];
  check: (params: Record<string, any>) => boolean;
  message: string;
};

const premessionRules: PermissionRule[] = [
  {
    // run_write 覆盖写入（非追加模式）需要用户确认
    tools: ["run_write"],
    check: (params) => params.append !== true,
    message: "This action will overwrite the file content. Do you want to proceed?",
  },
  {
    // run_bash 执行可能修改仓库状态或安装依赖的命令需要用户确认
    tools: ["run_bash"],
    check: (params) => {
      const sensitivePatterns = [
        /git\s+(commit|push|merge|rebase)/i,
        />\s*\S+/,
        /\bnpm\s+(publish|install)\b/i,
        /\bpnpm\s+install\b/i,
        /\byarn\s+add\b/i,
      ];
      return sensitivePatterns.some((p) => p.test(params.command || ""));
    },
    message: "This bash command may modify the repository or install packages. Do you want to proceed?",
  },
];
/**
 * 安全闸门 1 - 危险命令检测
 * 一张硬拒绝表，先查，命中就返回阻止信息
 */
export const checkCommandPermission = (command: string): boolean => {
  const dangerousPatterns = [
    /(^|\s)rm\s+/i,
    /(^|\s)rmdir\s+/i,
    /(^|\s)mv\s+/i,
    /(^|\s)dd\s+/i,
    /(^|\s)mkfs(\.[^\s]+)?\s+/i,
    /(^|\s)chmod\s+/i,
    /(^|\s)chown\s+/i,
    /(^|\s)find\b.*\s-delete(\s|$)/i,
    /git\s+clean\s+-/i,
    /git\s+reset\s+--hard/i,
    /(^|\s)sudo\s+/i,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(command));
};

/**
 * 安全闸门 2 - 规则匹配
 * 描述"什么时候需要问用户"。每条规则指定工具和检查条件。
 * 如果工具调用满足规则条件，系统将提示用户确认是否允许工具调用。
 */
export const checkCommandPermissionRules = (toolName: string, params: Record<string, any>): string => {
  for (const rule of premessionRules) {
    if (rule.tools.includes(toolName) && rule.check(params)) {
      return rule.message;
    }
  }
  return "";
};

/**
 * 安全闸门 3：规则命中后，暂停等用户输入。
 * 暂停时参照LangChain的checkPointer机制记录当前agent loop中断所处的位置，等待用户输入后再继续执行。
 * 用户输入 allow/deny 两种选项
 * - allow继续执行
 * - deny则针对当前tool的调用抛出异常，让上层补货到“工具权限拒绝”的错误。
 */
export const askUserForPermission = async (
  message: string,
  eventHandler?: EventHandler,
): Promise<boolean> => {
  const requestId = uuidv4();
  await eventHandler?.onPermissionRequest?.(requestId, message);
  return permissionStore.waitForDecision(requestId);
};
