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

const matchesCmdPatterns = (command: string, patterns: BashCmdPattern[]): boolean => {
  return patterns.some((pattern) => pattern.cmd.test(command));
};

const findMatchedCmdPattern = (command: string, patterns: BashCmdPattern[]): BashCmdPattern | undefined => {
  return patterns.find((pattern) => pattern.cmd.test(command));
};

const permissionRules: PermissionRule[] = [
  {
    tools: ["safe_path", "run_bash", "run_read", "run_write"],
    check: () => {
      throw new Error("Permission sandbox pre-check requires toolName context.");
    },
    message: "",
  },
  {
    tools: ["run_write"],
    check: (params) => params.append !== true,
    message: "This action will overwrite the file content. Do you want to proceed?",
  },
  {
    tools: ["run_bash"],
    check: (params) => {
      return matchesCmdPatterns(params.command || "", sensitiveCmdPatterns);
    },
    message: "This bash command may modify the repository or install packages. Do you want to proceed?",
  },
];

export const checkCommandPermission = (command: string): boolean => {
  const matchedPattern = findMatchedCmdPattern(command, dangerousCmdPatterns);
  if (!matchedPattern) {
    return false;
  }

  bashBlacklistStore.rememberBlockedPattern(matchedPattern, command);
  return true;
};

export const checkCommandPermissionRules = (toolName: string, params: Record<string, any>): string => {
  if (toolName === "run_bash") {
    const blacklistMessage = bashBlacklistStore.getPreflightBlockMessage(params.command || "");
    if (blacklistMessage) {
      throw new Error(blacklistMessage);
    }
  }

  for (const rule of permissionRules) {
    if (!rule.tools.includes(toolName)) {
      continue;
    }

    if (rule === permissionRules[0]) {
      ensureToolSandboxPermission(toolName, params);
      continue;
    }

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
