import z from "zod";
import type { RegisteredTool } from "../../engine/tool-manager";
import type { TaskManager } from "./task-manager";

export function createTaskCreateTool(manager: TaskManager): RegisteredTool {
  return {
    name: "task_create",
    description:
      "Create a persistent task in the current session. blockedBy task IDs must exist; reverse blocks links are maintained automatically.",
    parameters: {
      subject: z.string().trim().min(1).describe("Short task title."),
      description: z.string().trim().min(1).describe("Detailed task work and expected outcome."),
      blockedBy: z
        .array(z.string().trim().min(1))
        .optional()
        .describe("Existing task IDs that must be completed before this task can start."),
    },
    execute: async (input, context): Promise<{ taskId: string; subject: string }> => {
      const task = await manager.createTask(context.sessionId, {
        subject: input.subject,
        description: input.description,
        blockedBy: input.blockedBy,
      });
      return { taskId: task.id, subject: task.subject };
    },
  };
}
