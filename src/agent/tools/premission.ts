import { isAbsolute, resolve } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { permissionStore } from "../engine/permission-store";
import { EventHandler } from "../types/agent";

export const WORKSPACE = resolve(__dirname, "../../..");

export const isPathWithin = (targetPath: string, rootPath: string): boolean => {
  const normalizedRoot = resolve(rootPath);
  const normalizedTarget = resolve(targetPath);
  const rootWithSep = `${normalizedRoot}/`;

  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(rootWithSep);
};

export const ensureWithinWorkspace = (targetPath: string, label: string): string => {
  const resolvedPath = resolve(targetPath);

  if (!isPathWithin(resolvedPath, WORKSPACE)) {
    throw new Error(`${label} must be within the current workspace: ${WORKSPACE}`);
  }

  return resolvedPath;
};

const ensureToolSandboxPermission = (toolName: string, params: Record<string, any>): boolean => {
  if (toolName === "safe_path") {
    const sandboxRoot = ensureWithinWorkspace(params.sandboxRoot, "sandboxRoot");
    const resolvedPath = isAbsolute(params.inputPath)
      ? ensureWithinWorkspace(params.inputPath, "inputPath")
      : resolve(sandboxRoot, params.inputPath);

    ensureWithinWorkspace(resolvedPath, "resolvedPath");

    if (!isPathWithin(resolvedPath, sandboxRoot)) {
      throw new Error("Path is outside sandbox root.");
    }

    return false;
  }

  if (toolName === "run_bash") {
    ensureWithinWorkspace(params.cwd ? resolve(params.cwd) : WORKSPACE, "cwd");
    return false;
  }

  if (toolName === "run_read" || toolName === "run_write") {
    ensureWithinWorkspace(params.filePath, "filePath");
    return false;
  }

  return false;
};

type PermissionRule = {
  tools: string[];
  check: (params: Record<string, any>) => boolean;
  message: string;
};

const premessionRules: PermissionRule[] = [
  {
    // 最前置沙箱判断：只要路径越出当前工作区或 sandboxRoot，直接拒绝执行
    tools: ["safe_path", "run_bash", "run_read", "run_write"],
    check: (params) => {
      throw new Error("Permission sandbox pre-check requires toolName context.");
    },
    message: "",
  },
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
    if (!rule.tools.includes(toolName)) {
      continue;
    }

    if (rule === premessionRules[0]) {
      ensureToolSandboxPermission(toolName, params);
      continue;
    }

    if (rule.check(params)) {
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
