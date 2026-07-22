export const TASK_ERROR_CODES = [
  "TASK_NOT_FOUND",
  "TASK_VALIDATION_FAILED",
  "TASK_DEPENDENCY_CYCLE",
  "TASK_DATA_CORRUPTED",
  "TASK_STORE_FAILED",
  "TASK_ROLLBACK_FAILED",
] as const;

export type TaskErrorCode = (typeof TASK_ERROR_CODES)[number];

export class TaskSystemError extends Error {
  public readonly code: TaskErrorCode;
  public readonly cause?: unknown;

  constructor(code: TaskErrorCode, message: string, cause?: unknown) {
    super(`[${code}] ${message}`);
    this.name = "TaskSystemError";
    this.code = code;
    this.cause = cause;
  }
}

export function isTaskSystemError(error: unknown): error is TaskSystemError {
  return error instanceof TaskSystemError;
}
