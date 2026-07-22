import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { IdGenerator } from "../../memory/id-generator";
import { TaskSystemError, isTaskSystemError } from "./task-error";
import { taskSchema } from "./task-schema";
import type { Task } from "./type";

const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9_-]+$/;
const TASK_FILE_PATTERN = /^(task_[a-zA-Z0-9-]+)\.json$/;

export class TaskStore {
  private readonly rootDir: string;

  constructor(rootDir?: string) {
    this.rootDir = resolve(rootDir ?? join(process.cwd(), "data", ".douchat", "task"));
  }

  public async readTask(sessionId: string, taskId: string): Promise<Task> {
    const filePath = this.getTaskFilePath(sessionId, taskId);
    let raw: string;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch (error) {
      if (isENOENT(error)) {
        throw new TaskSystemError("TASK_NOT_FOUND", `Task ${taskId} was not found in this session.`);
      }
      throw new TaskSystemError("TASK_STORE_FAILED", `Failed to read task ${taskId}.`, error);
    }
    return this.parseTask(raw, taskId);
  }

  public async readTasks(sessionId: string): Promise<Task[]> {
    const sessionDir = this.getSessionDir(sessionId);
    let entries: string[];
    try {
      entries = await readdir(sessionDir);
    } catch (error) {
      if (isENOENT(error)) {
        return [];
      }
      throw new TaskSystemError("TASK_STORE_FAILED", `Failed to list tasks for session ${sessionId}.`, error);
    }

    const taskIds = entries
      .map((entry) => TASK_FILE_PATTERN.exec(entry)?.[1])
      .filter((taskId): taskId is string => taskId !== undefined)
      .sort();
    return Promise.all(taskIds.map((taskId) => this.readTask(sessionId, taskId)));
  }

  public async writeTask(sessionId: string, task: Task): Promise<void> {
    const parsedTask = taskSchema.safeParse(task);
    if (!parsedTask.success) {
      throw new TaskSystemError(
        "TASK_VALIDATION_FAILED",
        `Task ${task.id} cannot be persisted: ${parsedTask.error.message}`,
      );
    }
    await this.writeRawTask(sessionId, task.id, `${JSON.stringify(parsedTask.data, null, 2)}\n`);
  }

  public async writeTasks(sessionId: string, tasks: readonly Task[]): Promise<void> {
    const uniqueTasks = new Map(tasks.map((task) => [task.id, task]));
    if (uniqueTasks.size !== tasks.length) {
      throw new TaskSystemError("TASK_VALIDATION_FAILED", "A task batch cannot contain duplicate IDs.");
    }

    const snapshots = new Map<string, string | null>();
    for (const taskId of uniqueTasks.keys()) {
      snapshots.set(taskId, await this.readRawTaskIfExists(sessionId, taskId));
    }

    try {
      for (const task of uniqueTasks.values()) {
        await this.writeTask(sessionId, task);
      }
    } catch (error) {
      try {
        for (const [taskId, raw] of [...snapshots.entries()].reverse()) {
          if (raw === null) {
            await this.deleteTask(sessionId, taskId);
          } else {
            await this.writeRawTask(sessionId, taskId, raw);
          }
        }
      } catch (rollbackError) {
        throw new TaskSystemError(
          "TASK_ROLLBACK_FAILED",
          "Task batch write failed and rollback could not restore a consistent state.",
          rollbackError,
        );
      }
      if (isTaskSystemError(error)) {
        throw error;
      }
      throw new TaskSystemError("TASK_STORE_FAILED", "Task batch write failed and was rolled back.", error);
    }
  }

  private async readRawTaskIfExists(sessionId: string, taskId: string): Promise<string | null> {
    const filePath = this.getTaskFilePath(sessionId, taskId);
    try {
      return await readFile(filePath, "utf-8");
    } catch (error) {
      if (isENOENT(error)) {
        return null;
      }
      throw new TaskSystemError("TASK_STORE_FAILED", `Failed to snapshot task ${taskId}.`, error);
    }
  }

  private async writeRawTask(sessionId: string, taskId: string, raw: string): Promise<void> {
    const filePath = this.getTaskFilePath(sessionId, taskId);
    const tempPath = this.resolveWithinRoot(
      `${filePath}.${process.pid}.${IdGenerator.generate("tool_call")}.tmp`,
    );
    await mkdir(dirname(filePath), { recursive: true });
    try {
      await writeFile(tempPath, raw, "utf-8");
      await rename(tempPath, filePath);
    } catch (error) {
      await unlink(tempPath).catch(() => undefined);
      throw new TaskSystemError("TASK_STORE_FAILED", `Failed to write task ${taskId}.`, error);
    }
  }

  private async deleteTask(sessionId: string, taskId: string): Promise<void> {
    try {
      await unlink(this.getTaskFilePath(sessionId, taskId));
    } catch (error) {
      if (!isENOENT(error)) {
        throw new TaskSystemError("TASK_STORE_FAILED", `Failed to remove task ${taskId}.`, error);
      }
    }
  }

  private parseTask(raw: string, taskId: string): Task {
    try {
      const parsed: unknown = JSON.parse(raw);
      const task = taskSchema.parse(parsed);
      if (task.id !== taskId) {
        throw new Error(`Task ID ${task.id} does not match filename ${taskId}.`);
      }
      return task;
    } catch (error) {
      throw new TaskSystemError("TASK_DATA_CORRUPTED", `Task file ${taskId}.json is invalid.`, error);
    }
  }

  private getSessionDir(sessionId: string): string {
    this.assertSafeSegment(sessionId, "sessionId");
    return this.resolveWithinRoot(join(this.rootDir, sessionId));
  }

  private getTaskFilePath(sessionId: string, taskId: string): string {
    this.assertSafeSegment(taskId, "taskId");
    if (!taskId.startsWith("task_")) {
      throw new TaskSystemError("TASK_VALIDATION_FAILED", `Invalid taskId: ${taskId}`);
    }
    return this.resolveWithinRoot(join(this.getSessionDir(sessionId), `${taskId}.json`));
  }

  private assertSafeSegment(segment: string, label: string): void {
    if (!SAFE_PATH_SEGMENT.test(segment)) {
      throw new TaskSystemError("TASK_VALIDATION_FAILED", `Invalid ${label}: ${segment}`);
    }
  }

  private resolveWithinRoot(filePath: string): string {
    const resolved = resolve(filePath);
    const rel = relative(this.rootDir, resolved);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new TaskSystemError("TASK_VALIDATION_FAILED", `Task path escapes storage root: ${filePath}`);
    }
    return resolved;
  }
}

function isENOENT(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
