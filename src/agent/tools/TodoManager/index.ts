import z from "zod";
import { RegisteredTool } from "../../engine/tool-manager";

export type TodoStatus = "pending" | "in_progress" | "completed";

export type TodoItemInput = {
  content: unknown;
  status?: unknown;
  activeForm?: unknown;
  active_form?: unknown;
};

export type TodoItem = {
  content: string;
  status: TodoStatus;
  activeForm: string;
};

const REMINDER_MESSAGE = "<reminder>Refresh your current plan before continuing.</reminder>";
const PLAN_REMINDER_INTERVAL = 3;
const MAX_TODO_ITEMS = 12;

export class TodoManager {
  private items: TodoItem[];
  private roundsSinceUpdate: number;

  constructor(initialItems: TodoItemInput[] = []) {
    this.items = this.normalizeItems(initialItems);
    this.roundsSinceUpdate = 0;
  }

  public update(items: TodoItemInput[]): string {
    this.items = this.normalizeItems(items);
    this.roundsSinceUpdate = 0;
    return this.render();
  }

  public noteRoundWithoutUpdate(): void {
    this.roundsSinceUpdate += 1;
  }

  public reminder(): string | null {
    if (this.items.length === 0) {
      return null;
    }
    if (this.roundsSinceUpdate < PLAN_REMINDER_INTERVAL) {
      return null;
    }
    return REMINDER_MESSAGE;
  }

  public render(): string {
    if (this.items.length === 0) {
      return "No session plan yet.";
    }

    const lines = this.items.map((item) => {
      const marker: Record<TodoStatus, string> = {
        pending: "[ ]",
        in_progress: "[>]",
        completed: "[x]",
      };
      let line = `${marker[item.status]} ${item.content}`;
      if (item.status === "in_progress" && item.activeForm) {
        line += ` (${item.activeForm})`;
      }
      return line;
    });

    const completed = this.items.filter((item) => item.status === "completed").length;
    lines.push(`\n(${completed}/${this.items.length} completed)`);
    return lines.join("\n");
  }

  public getItems(): TodoItem[] {
    return this.items.map((item) => ({ ...item }));
  }

  public getRoundSinceUpdate(): number {
    return this.roundsSinceUpdate;
  }

  public getRoundsSinceUpdate(): number {
    return this.roundsSinceUpdate;
  }

  private normalizeItems(items: TodoItemInput[]): TodoItem[] {
    if (items.length > MAX_TODO_ITEMS) {
      throw new Error("Keep the session plan short (max 12 items)");
    }

    let inProgressCount = 0;
    const normalized = items.map((item, index) => {
      const content = String(item.content ?? "").trim();
      const status = String(item.status ?? "pending").toLowerCase();
      const activeForm = String(item.activeForm ?? item.active_form ?? "").trim();

      if (!content) {
        throw new Error(`Item ${index}: content required`);
      }
      if (!this.isTodoStatus(status)) {
        throw new Error(`Item ${index}: invalid status '${status}'`);
      }
      if (status === "in_progress") {
        inProgressCount += 1;
      }

      return { content, status, activeForm };
    });

    if (inProgressCount > 1) {
      throw new Error("Only one plan item can be in_progress");
    }

    return normalized;
  }

  private isTodoStatus(status: string): status is TodoStatus {
    return status === "pending" || status === "in_progress" || status === "completed";
  }
}

export const registerTodoTools = (): RegisteredTool[] => {
  const manager = new TodoManager();

  const todo: RegisteredTool = {
    name: "todo",
    description: "Rewrite the current session plan for multi-step work.",
    parameters: {
      items: z
        .array(
          z.object({
            content: z.string(),
            status: z.enum(["pending", "in_progress", "completed"]),
            activeForm: z.string().optional().describe("Optional present-continuous label."),
          }),
        )
        .describe("The updated session plan items."),
    },
    execute: async (input): Promise<string> => {
      return manager.update(input.items);
    },
  };

  return [todo];
};

export { MAX_TODO_ITEMS, PLAN_REMINDER_INTERVAL, REMINDER_MESSAGE };