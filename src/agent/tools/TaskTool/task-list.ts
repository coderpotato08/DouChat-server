import z from "zod";
import type { RegisteredTool } from "../../engine/tool-manager";
import type { TaskManager } from "./task-manager";
import { TASK_STATUSES } from "./task-schema";
import type { Task } from "./type";

export function createTaskListTool(manager: TaskManager): RegisteredTool {
  return {
    name: "task_list",
    description:
      "List persistent tasks in the current session, ordered by creation time. Optionally filter by status.",
    parameters: {
      status: z.enum(TASK_STATUSES).optional().describe("Optional task status filter."),
    },
    execute: async (input, context): Promise<{ tasks: Task[] }> => {
      const tasks = await manager.listTasks(context.sessionId, input.status);
      return { tasks };
    },
  };
}
