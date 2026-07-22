import z from "zod";
import type { RegisteredTool } from "../../engine/tool-manager";
import type { TaskManager } from "./task-manager";
import type { Task } from "./type";

export function createTaskGetTool(manager: TaskManager): RegisteredTool {
  return {
    name: "task_get",
    description: "Get one persistent task from the current session by task ID.",
    parameters: {
      taskId: z.string().trim().min(1).describe("Task ID returned by task_create or task_list."),
    },
    execute: async (input, context): Promise<{ task: Task }> => {
      const task = await manager.getTask(context.sessionId, input.taskId);
      return { task };
    },
  };
}
