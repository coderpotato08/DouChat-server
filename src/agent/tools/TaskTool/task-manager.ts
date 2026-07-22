import { IdGenerator } from "../../memory/id-generator";
import { validateTaskDependencyGraph } from "./dependency-graph";
import { TaskSystemError } from "./task-error";
import { TaskStore } from "./task-store";
import type { CreateTaskInput, Task, TaskStatus, UpdateTaskInput } from "./type";

export class TaskManager {
  private readonly store: TaskStore;

  constructor(store: TaskStore = new TaskStore()) {
    this.store = store;
  }

  public async createTask(sessionId: string, input: CreateTaskInput): Promise<Task> {
    const tasks = await this.store.readTasks(sessionId);
    validateTaskDependencyGraph(tasks);
    const now = new Date().toISOString();
    const task: Task = {
      id: `task_${IdGenerator.generate("task")}`,
      subject: this.requireText(input.subject, "subject"),
      description: this.requireText(input.description, "description"),
      status: "pending",
      owner: null,
      blocks: [],
      blockedBy: this.normalizeDependencies(input.blockedBy ?? []),
      createdAt: now,
      updatedAt: now,
    };

    const previousTasks = new Map(tasks.map((current) => [current.id, current]));
    const nextTasks = [...tasks.map(cloneTask), task];
    this.rebuildBlocks(nextTasks);
    this.validateCandidateTasks(nextTasks);
    const changedTasks = this.collectChangedTasks(previousTasks, nextTasks, now);
    await this.store.writeTasks(sessionId, changedTasks);
    return nextTasks.find((current) => current.id === task.id) ?? task;
  }

  public async getTask(sessionId: string, taskId: string): Promise<Task> {
    return this.store.readTask(sessionId, taskId);
  }

  public async listTasks(sessionId: string, status?: TaskStatus): Promise<Task[]> {
    const tasks = await this.store.readTasks(sessionId);
    validateTaskDependencyGraph(tasks);
    return tasks
      .filter((task) => status === undefined || task.status === status)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  }

  public async updateTask(
    sessionId: string,
    taskId: string,
    input: UpdateTaskInput,
  ): Promise<Task> {
    if (Object.values(input).every((value) => value === undefined)) {
      throw new TaskSystemError("TASK_VALIDATION_FAILED", "task_update requires at least one field to update.");
    }

    const tasks = await this.store.readTasks(sessionId);
    validateTaskDependencyGraph(tasks);
    const targetIndex = tasks.findIndex((task) => task.id === taskId);
    if (targetIndex === -1) {
      throw new TaskSystemError("TASK_NOT_FOUND", `Task ${taskId} was not found in this session.`);
    }

    const previousTasks = new Map(tasks.map((task) => [task.id, task]));
    const nextTasks = tasks.map(cloneTask);
    const current = nextTasks[targetIndex];
    nextTasks[targetIndex] = {
      ...current,
      subject: input.subject === undefined ? current.subject : this.requireText(input.subject, "subject"),
      description:
        input.description === undefined
          ? current.description
          : this.requireText(input.description, "description"),
      status: input.status ?? current.status,
      blockedBy:
        input.blockedBy === undefined
          ? current.blockedBy
          : this.normalizeDependencies(input.blockedBy),
    };

    this.rebuildBlocks(nextTasks);
    this.validateCandidateTasks(nextTasks);
    const now = new Date().toISOString();
    const changedTasks = this.collectChangedTasks(previousTasks, nextTasks, now);
    if (changedTasks.length === 0) {
      return nextTasks[targetIndex];
    }
    await this.store.writeTasks(sessionId, changedTasks);
    return nextTasks[targetIndex];
  }

  private validateCandidateTasks(tasks: readonly Task[]): void {
    validateTaskDependencyGraph(tasks);
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    for (const task of tasks) {
      if (task.status === "pending") {
        continue;
      }
      const incompleteDependency = task.blockedBy
        .map((dependencyId) => taskMap.get(dependencyId))
        .find((dependency) => dependency?.status !== "completed");
      if (incompleteDependency) {
        throw new TaskSystemError(
          "TASK_VALIDATION_FAILED",
          `Task ${task.id} cannot be ${task.status} while dependency ${incompleteDependency.id} is ${incompleteDependency.status}.`,
        );
      }
    }
  }

  private rebuildBlocks(tasks: Task[]): void {
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    for (const task of tasks) {
      task.blocks = [];
    }
    for (const task of tasks) {
      for (const dependencyId of task.blockedBy) {
        const dependency = taskMap.get(dependencyId);
        if (!dependency) {
          throw new TaskSystemError(
            "TASK_VALIDATION_FAILED",
            `Task ${task.id} references missing dependency ${dependencyId}.`,
          );
        }
        dependency.blocks.push(task.id);
      }
    }
    for (const task of tasks) {
      task.blocks.sort();
    }
  }

  private collectChangedTasks(
    previousTasks: ReadonlyMap<string, Task>,
    nextTasks: Task[],
    updatedAt: string,
  ): Task[] {
    const changedTasks: Task[] = [];
    for (const task of nextTasks) {
      const previous = previousTasks.get(task.id);
      if (!previous || taskContentSignature(previous) !== taskContentSignature(task)) {
        task.updatedAt = previous ? updatedAt : task.updatedAt;
        changedTasks.push(task);
      }
    }
    return changedTasks;
  }

  private normalizeDependencies(dependencies: readonly string[]): string[] {
    const normalized = dependencies.map((dependencyId) => dependencyId.trim());
    if (normalized.some((dependencyId) => dependencyId.length === 0)) {
      throw new TaskSystemError("TASK_VALIDATION_FAILED", "blockedBy cannot contain an empty task ID.");
    }
    if (new Set(normalized).size !== normalized.length) {
      throw new TaskSystemError("TASK_VALIDATION_FAILED", "blockedBy cannot contain duplicate task IDs.");
    }
    return normalized.sort();
  }

  private requireText(value: string, field: "subject" | "description"): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new TaskSystemError("TASK_VALIDATION_FAILED", `${field} is required.`);
    }
    return normalized;
  }
}

function cloneTask(task: Task): Task {
  return { ...task, blocks: [...task.blocks], blockedBy: [...task.blockedBy] };
}

function taskContentSignature(task: Task): string {
  return JSON.stringify({
    id: task.id,
    subject: task.subject,
    description: task.description,
    status: task.status,
    owner: task.owner,
    blocks: task.blocks,
    blockedBy: task.blockedBy,
    createdAt: task.createdAt,
  });
}
