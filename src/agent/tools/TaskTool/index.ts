import type { RegisteredTool } from "../../engine/tool-manager";
import { createTaskCreateTool } from "./task-create";
import { createTaskGetTool } from "./task-get";
import { createTaskListTool } from "./task-list";
import { TaskManager } from "./task-manager";
import { TaskStore } from "./task-store";
import { createTaskUpdateTool } from "./task-update";

export function registerTaskTools(): RegisteredTool[] {
  const manager = new TaskManager(new TaskStore());
  return [
    createTaskCreateTool(manager),
    createTaskGetTool(manager),
    createTaskListTool(manager),
    createTaskUpdateTool(manager),
  ];
}
