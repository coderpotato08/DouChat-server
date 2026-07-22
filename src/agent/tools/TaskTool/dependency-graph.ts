import type { Task } from "./type";
import { TaskSystemError } from "./task-error";

export function validateTaskDependencyGraph(tasks: readonly Task[]): void {
  const taskMap = new Map<string, Task>();
  const expectedBlocks = new Map<string, Set<string>>();

  for (const task of tasks) {
    if (taskMap.has(task.id)) {
      throw new TaskSystemError("TASK_DATA_CORRUPTED", `Duplicate task ID: ${task.id}`);
    }
    taskMap.set(task.id, task);
    expectedBlocks.set(task.id, new Set());
  }

  for (const task of tasks) {
    const uniqueDependencies = new Set(task.blockedBy);
    if (uniqueDependencies.size !== task.blockedBy.length) {
      throw new TaskSystemError(
        "TASK_DATA_CORRUPTED",
        `Task ${task.id} contains duplicate blockedBy entries.`,
      );
    }

    for (const dependencyId of task.blockedBy) {
      if (dependencyId === task.id) {
        throw new TaskSystemError(
          "TASK_VALIDATION_FAILED",
          `Task ${task.id} cannot depend on itself.`,
        );
      }
      if (!taskMap.has(dependencyId)) {
        throw new TaskSystemError(
          "TASK_VALIDATION_FAILED",
          `Task ${task.id} references missing dependency ${dependencyId}.`,
        );
      }
      expectedBlocks.get(dependencyId)?.add(task.id);
    }
  }

  validateNoCycles(taskMap);

  for (const task of tasks) {
    const actual = [...task.blocks].sort();
    const expected = [...(expectedBlocks.get(task.id) ?? [])].sort();
    if (!arraysEqual(actual, expected)) {
      throw new TaskSystemError(
        "TASK_DATA_CORRUPTED",
        `Task ${task.id} has inconsistent blocks; expected [${expected.join(", ")}].`,
      );
    }
  }
}

function validateNoCycles(taskMap: ReadonlyMap<string, Task>): void {
  const state = new Map<string, "visiting" | "visited">();
  const stack: string[] = [];

  const visit = (taskId: string): void => {
    const currentState = state.get(taskId);
    if (currentState === "visited") {
      return;
    }
    if (currentState === "visiting") {
      const cycleStart = stack.indexOf(taskId);
      const cycle = [...stack.slice(cycleStart), taskId];
      throw new TaskSystemError(
        "TASK_DEPENDENCY_CYCLE",
        `Task dependency cycle detected: ${cycle.join(" -> ")}`,
      );
    }

    state.set(taskId, "visiting");
    stack.push(taskId);
    const task = taskMap.get(taskId);
    for (const dependencyId of task?.blockedBy ?? []) {
      visit(dependencyId);
    }
    stack.pop();
    state.set(taskId, "visited");
  };

  for (const taskId of taskMap.keys()) {
    visit(taskId);
  }
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
