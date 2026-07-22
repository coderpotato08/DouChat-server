import z from "zod";
import type { Task, TaskStatus } from "./type";

export const TASK_STATUSES = ["pending", "in_progress", "completed"] as const satisfies readonly TaskStatus[];

export const taskStatusSchema = z.enum(TASK_STATUSES);

export const taskSchema: z.ZodType<Task> = z.object({
  id: z.string().regex(/^task_[a-zA-Z0-9-]+$/),
  subject: z.string().trim().min(1),
  description: z.string().trim().min(1),
  status: taskStatusSchema,
  owner: z.string().trim().min(1).nullable().optional(),
  blocks: z.array(z.string().regex(/^task_[a-zA-Z0-9-]+$/)),
  blockedBy: z.array(z.string().regex(/^task_[a-zA-Z0-9-]+$/)),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
