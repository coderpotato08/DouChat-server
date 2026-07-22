import z from "zod";
import type { RegisteredTool } from "../../engine/tool-manager";
import type { TaskManager } from "./task-manager";
import { TASK_STATUSES } from "./task-schema";
import type { Task } from "./type";

export function createTaskUpdateTool(manager: TaskManager): RegisteredTool {
  return {
    name: "task_update",
    description:
      "Update a persistent task in the current session. blockedBy replaces the complete dependency list; blocks is maintained automatically. A task can be in_progress or completed only after all dependencies are completed.",
    parameters: {
      taskId: z.string().trim().min(1).describe("Task ID to update."),
      subject: z.string().trim().min(1).optional().describe("Replacement task title."),
      description: z.string().trim().min(1).optional().describe("Replacement task description."),
      status: z.enum(TASK_STATUSES).optional().describe("Replacement task status."),
      blockedBy: z
        .array(z.string().trim().min(1))
        .optional()
        .describe("Complete replacement list of prerequisite task IDs; use [] to clear dependencies."),
    },
    execute: async (input, context): Promise<{ task: Task }> => {
      const task = await manager.updateTask(context.sessionId, input.taskId, {
        subject: input.subject,
        description: input.description,
        status: input.status,
        blockedBy: input.blockedBy,
      });
      return { task };
    },
  };
}
