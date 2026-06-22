import { isAbsolute, resolve } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { EventHandler } from "../types/agent";
import { bashBlacklistStore } from "./bash-blacklist-store";
import { BashCmdPattern, dangerousCmdPatterns, sensitiveCmdPatterns } from "./bash-cmd-patterns";
import { permissionStore } from "./permission-store";

export { bashBlacklistStore } from "./bash-blacklist-store";
export { permissionStore } from "./permission-store";

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

const ensureSafePathSandboxPermission = (params: Record<string, any>): void => {
  const sandboxRoot = ensureWithinWorkspace(params.sandboxRoot, "sandboxRoot");
  const resolvedPath = isAbsolute(params.inputPath)
    ? ensureWithinWorkspace(params.inputPath, "inputPath")
    : resolve(sandboxRoot, params.inputPath);

  ensureWithinWorkspace(resolvedPath, "resolvedPath");

  if (!isPathWithin(resolvedPath, sandboxRoot)) {
    throw new Error("Path is outside sandbox root.");
  }
};

const ensureRunBashSandboxPermission = (params: Record<string, any>): void => {
  ensureWithinWorkspace(params.cwd ? resolve(params.cwd) : WORKSPACE, "cwd");
};

const ensureFilePathSandboxPermission = (params: Record<string, any>): void => {
  ensureWithinWorkspace(params.filePath, "filePath");
};

// 单条“需要人工确认”的权限规则。
// check 只负责判断是否命中，message 负责提供给上层的确认提示文案。
type ConfirmationRule = {
  check: (params: Record<string, any>) => boolean;
  message: string;
};

// 工具权限策略表中的单个策略定义。
// 这里把权限拆成三个阶段
type ToolPermissionPolicy = {
  // 1. sandbox：做路径/工作目录这类硬约束校验
  sandbox?: (params: Record<string, any>) => void;
  // 2. preflight：做真正执行前的前置拒绝，例如会话黑名单
  preflight?: (params: Record<string, any>) => void;
  // 3. confirm：命中后不直接拒绝，而是转为人工确认
  confirm?: ConfirmationRule[];
};

const matchesCmdPatterns = (command: string, patterns: BashCmdPattern[]): boolean => {
  return patterns.some((pattern) => pattern.cmd.test(command));
};

const findMatchedCmdPattern = (command: string, patterns: BashCmdPattern[]): BashCmdPattern | undefined => {
  return patterns.find((pattern) => pattern.cmd.test(command));
};

// 权限策略表：用“工具名 -> 权限策略”的方式做分发，避免在主流程里散落 toolName === xxx 的硬编码判断。
// 外部依然只需要调用 checkCommandPermissionRules，内部再按具体工具调度 sandbox / preflight / confirm。
const toolPermissionPolicies: Partial<Record<string, ToolPermissionPolicy>> = {
  safe_path: {
    sandbox: ensureSafePathSandboxPermission,
  },
  run_bash: {
    sandbox: ensureRunBashSandboxPermission,
    // run_bash 在真正进入工具执行层前，先检查当前会话是否已经把这类高危命令加入黑名单。
    preflight: (params) => {
      const blacklistMessage = bashBlacklistStore.getPreflightBlockMessage(params.command || "");
      if (blacklistMessage) {
        throw new Error(blacklistMessage);
      }
    },
    confirm: [
      {
        // 非强制禁止但有副作用的命令，不直接拦截，而是转成人工确认。
        check: (params) => matchesCmdPatterns(params.command || "", sensitiveCmdPatterns),
        message: "This bash command may modify the repository or install packages. Do you want to proceed?",
      },
    ],
  },
  run_read: {
    sandbox: ensureFilePathSandboxPermission,
  },
  run_write: {
    sandbox: ensureFilePathSandboxPermission,
    confirm: [
      {
        check: (params) => params.append !== true,
        message: "This action will overwrite the file content. Do you want to proceed?",
      },
    ],
  },
};

export const checkCommandPermission = (command: string): boolean => {
  const matchedPattern = findMatchedCmdPattern(command, dangerousCmdPatterns);
  if (!matchedPattern) {
    return false;
  }

  // 强制禁止命中时，除了返回 true 给执行层拦截，还会把模板记进当前会话黑名单，供后续 prompt 注入和二次预拦截复用。
  bashBlacklistStore.rememberBlockedPattern(matchedPattern, command);
  return true;
};

export const checkCommandPermissionRules = (toolName: string, params: Record<string, any>): string => {
  // 主流程本身不关心具体工具细节，只负责按策略表统一调度权限阶段。
  const policy = toolPermissionPolicies[toolName];
  if (!policy) {
    return "";
  }

  policy.preflight?.(params);
  policy.sandbox?.(params);

  for (const rule of policy.confirm || []) {
    if (rule.check(params)) {
      return rule.message;
    }
  }

  return "";
};

export const buildBashBlacklistSystemPrompt = (sessionId: string): string => {
  return bashBlacklistStore.buildSystemPromptConstraint(sessionId);
};

export const askUserForPermission = async (
  message: string,
  eventHandler?: EventHandler,
): Promise<boolean> => {
  const requestId = uuidv4();
  await eventHandler?.onPermissionRequest?.(requestId, message);
  return permissionStore.waitForDecision(requestId);
};
