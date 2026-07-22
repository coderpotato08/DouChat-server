export type TaskStatus = "pending" | "in_progress" | "completed";

export type Task = {
  id: string;
  subject: string;
  description: string;
  status: TaskStatus;
  owner?: string | null;
  blocks: string[];
  blockedBy: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskInput = {
  subject: string;
  description: string;
  blockedBy?: string[];
};

export type UpdateTaskInput = {
  subject?: string;
  description?: string;
  status?: TaskStatus;
  blockedBy?: string[];
};
