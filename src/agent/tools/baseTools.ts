import z from "zod";
import { RegisteredTool } from "../engine/tool-manager";
import { resolve, isAbsolute, dirname } from "node:path";
import { promisify } from "node:util";
import { exec } from "node:child_process";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";

const WORKSPACE = resolve(__dirname, "../../..");
const execAsync = promisify(exec);

const isPathWithin = (targetPath: string, rootPath: string): boolean => {
  const normalizedRoot = resolve(rootPath);
  const normalizedTarget = resolve(targetPath);
  const rootWithSep = `${normalizedRoot}/`;

  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(rootWithSep);
};

const ensureWithinWorkspace = (targetPath: string, label: string): string => {
  const resolvedPath = resolve(targetPath);

  if (!isPathWithin(resolvedPath, WORKSPACE)) {
    throw new Error(`${label} must be within the current workspace: ${WORKSPACE}`);
  }

  return resolvedPath;
};

const containsDangerousCommand = (command: string): boolean => {
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

export const registerBaseTools = (): RegisteredTool[] => {
  const safePath: RegisteredTool = {
    name: "safe_path",
    description:
      "Resolve and validate a path for local IO. Both sandboxRoot and the resolved result must stay inside the current project workspace, and the final path must remain within sandboxRoot.",
    parameters: {
      inputPath: z.string().describe("User provided relative or absolute path to validate."),
      sandboxRoot: z
        .string()
        .describe(
          "Sandbox root directory for IO operations. It must be inside the current project workspace.",
        ),
    },

    execute: async (input): Promise<string> => {
      const sandboxRoot = ensureWithinWorkspace(input.sandboxRoot, "sandboxRoot");
      const resolvedPath = isAbsolute(input.inputPath)
        ? ensureWithinWorkspace(input.inputPath, "inputPath")
        : resolve(sandboxRoot, input.inputPath);

      ensureWithinWorkspace(resolvedPath, "resolvedPath");
      const isWithinSandbox = isPathWithin(resolvedPath, sandboxRoot);

      if (!isWithinSandbox) {
        throw new Error("Path is outside sandbox root.");
      }

      return resolvedPath;
    },
  };

  const runBash: RegisteredTool = {
    name: "run_bash",
    description:
      "Run a local bash command only inside the current project workspace or a validated subdirectory. Dangerous file operations such as delete, move, permission changes, destructive git commands, or privileged commands are forbidden.",
    parameters: {
      command: z.string().describe("The bash command to execute."),
      cwd: z
        .string()
        .optional()
        .describe("Working directory for the command. It must stay inside the current project workspace."),
      timeoutMs: z.number().min(1).optional().describe("Maximum execution time in milliseconds."),
    },
    execute: async (
      input,
    ): Promise<{
      command: string;
      cwd: string;
      timeoutMs: number;
      stdout: string;
      stderr: string;
      exitCode: number;
    }> => {
      if (!input.command?.trim()) {
        throw new Error("command is required.");
      }

      if (containsDangerousCommand(input.command)) {
        throw new Error("Dangerous file operations are not allowed in run_bash.");
      }

      const cwd = ensureWithinWorkspace(input.cwd ? resolve(input.cwd) : WORKSPACE, "cwd");
      const timeoutMs = input.timeoutMs && input.timeoutMs > 0 ? input.timeoutMs : 10000;

      try {
        const { stdout, stderr } = await execAsync(input.command, {
          cwd,
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024,
        });
        return {
          command: input.command,
          cwd,
          timeoutMs,
          stdout,
          stderr,
          exitCode: 0,
        };
      } catch (error: any) {
        return {
          command: input.command,
          cwd,
          timeoutMs,
          stdout: error?.stdout || "",
          stderr: error?.stderr || error?.message || "run_bash failed",
          exitCode: typeof error?.code === "number" ? error.code : 1,
        };
      }
    },
  };

  const runRead: RegisteredTool = {
    name: "run_read",
    description:
      "Read a local text file and return file content or selected lines. The target file must stay inside the current project workspace.",
    parameters: {
      filePath: z.string().describe("Absolute or sandbox-relative file path."),
      startLine: z.number().int().min(1).optional().describe("1-based start line for partial reads."),
      endLine: z.number().int().min(1).optional().describe("1-based inclusive end line for partial reads."),
    },
    execute: async (
      input,
    ): Promise<{
      filePath: string;
      startLine?: number;
      endLine?: number;
      content: string;
    }> => {
      if (!input.filePath?.trim()) {
        throw new Error("filePath is required.");
      }

      const filePath = ensureWithinWorkspace(input.filePath, "filePath");
      const raw = await readFile(filePath, "utf-8");

      if (!input.startLine && !input.endLine) {
        return {
          filePath,
          content: raw,
        };
      }

      const startLine = input.startLine && input.startLine > 0 ? input.startLine : 1;
      const lines = raw.split("\n");
      const endLine = input.endLine && input.endLine >= startLine ? input.endLine : lines.length;

      return {
        filePath,
        startLine,
        endLine,
        content: lines.slice(startLine - 1, endLine).join("\n"),
      };
    },
  };

  const runWrite: RegisteredTool = {
    name: "run_write",
    description:
      "Write text content to a local file, optionally with append mode. The target file must stay inside the current project workspace.",
    parameters: {
      filePath: z.string().describe("Absolute or sandbox-relative file path."),
      content: z.string().describe("Text content to write."),
      append: z.boolean().optional().describe("If true, append to file instead of overwrite."),
    },
    execute: async (
      input,
    ): Promise<{
      filePath: string;
      append: boolean;
      bytesWritten: number;
    }> => {
      if (!input.filePath?.trim()) {
        throw new Error("filePath is required.");
      }

      const filePath = ensureWithinWorkspace(input.filePath, "filePath");
      const append = !!input.append;
      await mkdir(dirname(filePath), { recursive: true });

      if (append) {
        await appendFile(filePath, input.content, "utf-8");
      } else {
        await writeFile(filePath, input.content, "utf-8");
      }

      return {
        filePath,
        append,
        bytesWritten: Buffer.byteLength(input.content, "utf-8"),
      };
    },
  };

  return [safePath, runBash, runWrite, runRead];
};
