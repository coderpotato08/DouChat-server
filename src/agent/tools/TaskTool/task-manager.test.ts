import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { TaskSystemError } from "./task-error";
import { TaskManager } from "./task-manager";
import { TaskStore } from "./task-store";

async function createManager(): Promise<{ rootDir: string; manager: TaskManager; store: TaskStore }> {
  const rootDir = await mkdtemp(join(tmpdir(), "douchat-task-test-"));
  const store = new TaskStore(rootDir);
  return { rootDir, store, manager: new TaskManager(store) };
}

async function removeRoot(rootDir: string): Promise<void> {
  await rm(rootDir, { recursive: true, force: true });
}

test("TaskManager persists tasks and maintains reverse dependency links", async () => {
  const { rootDir, manager, store } = await createManager();
  try {
    const first = await manager.createTask("session_alpha", {
      subject: "Prepare API contract",
      description: "Define the task tool API.",
    });
    const second = await manager.createTask("session_alpha", {
      subject: "Implement handlers",
      description: "Implement the API after the contract is complete.",
      blockedBy: [first.id],
    });

    assert.equal(first.status, "pending");
    assert.match(first.id, /^task_[a-f0-9-]+$/);
    assert.deepEqual((await manager.getTask("session_alpha", first.id)).blocks, [second.id]);
    assert.deepEqual((await manager.getTask("session_alpha", second.id)).blockedBy, [first.id]);

    const raw = await readFile(join(rootDir, "session_alpha", `${first.id}.json`), "utf-8");
    assert.equal(JSON.parse(raw).id, first.id);
  } finally {
    await removeRoot(rootDir);
  }
});

test("TaskManager enforces dependency completion and prevents completed prerequisites from regressing", async () => {
  const { rootDir, manager } = await createManager();
  try {
    const prerequisite = await manager.createTask("session_state", {
      subject: "Finish prerequisite",
      description: "Complete the prerequisite task.",
    });
    const dependent = await manager.createTask("session_state", {
      subject: "Start dependent work",
      description: "This work must wait for its prerequisite.",
      blockedBy: [prerequisite.id],
    });

    await assert.rejects(
      manager.updateTask("session_state", dependent.id, { status: "in_progress" }),
      hasTaskError("TASK_VALIDATION_FAILED"),
    );

    await manager.updateTask("session_state", prerequisite.id, { status: "completed" });
    await manager.updateTask("session_state", dependent.id, { status: "in_progress" });

    await assert.rejects(
      manager.updateTask("session_state", prerequisite.id, { status: "pending" }),
      hasTaskError("TASK_VALIDATION_FAILED"),
    );
  } finally {
    await removeRoot(rootDir);
  }
});

test("TaskManager replaces blockedBy links, rejects cycles, and preserves existing data after rejection", async () => {
  const { rootDir, manager } = await createManager();
  try {
    const first = await manager.createTask("session_graph", {
      subject: "First task",
      description: "First graph node.",
    });
    const second = await manager.createTask("session_graph", {
      subject: "Second task",
      description: "Second graph node.",
    });
    const third = await manager.createTask("session_graph", {
      subject: "Third task",
      description: "Third graph node.",
      blockedBy: [first.id],
    });

    await manager.updateTask("session_graph", third.id, { blockedBy: [second.id] });
    assert.deepEqual((await manager.getTask("session_graph", first.id)).blocks, []);
    assert.deepEqual((await manager.getTask("session_graph", second.id)).blocks, [third.id]);

    await assert.rejects(
      manager.updateTask("session_graph", second.id, { blockedBy: [third.id] }),
      hasTaskError("TASK_DEPENDENCY_CYCLE"),
    );
    assert.deepEqual((await manager.getTask("session_graph", second.id)).blockedBy, []);
    assert.deepEqual((await manager.getTask("session_graph", third.id)).blockedBy, [second.id]);
  } finally {
    await removeRoot(rootDir);
  }
});

test("TaskManager filters task lists, isolates sessions, and fails strictly for corrupted JSON", async () => {
  const { rootDir, manager } = await createManager();
  try {
    const first = await manager.createTask("session_list", {
      subject: "First list task",
      description: "First task for ordering.",
    });
    await new Promise((resolve) => setTimeout(resolve, 1));
    const second = await manager.createTask("session_list", {
      subject: "Second list task",
      description: "Second task for ordering.",
    });
    await manager.updateTask("session_list", first.id, { status: "completed" });
    await manager.createTask("session_other", {
      subject: "Other session task",
      description: "Must not leak into session_list.",
    });

    assert.deepEqual(
      (await manager.listTasks("session_list")).map((task) => task.id),
      [first.id, second.id],
    );
    assert.deepEqual(
      (await manager.listTasks("session_list", "completed")).map((task) => task.id),
      [first.id],
    );

    await writeFile(join(rootDir, "session_list", "task_bad.json"), "{ not valid json", "utf-8");
    await assert.rejects(manager.listTasks("session_list"), hasTaskError("TASK_DATA_CORRUPTED"));
  } finally {
    await removeRoot(rootDir);
  }
});

test("TaskStore rejects path traversal identifiers", async () => {
  const { rootDir, store } = await createManager();
  try {
    await assert.rejects(store.readTasks("../outside"), hasTaskError("TASK_VALIDATION_FAILED"));
    await assert.rejects(store.readTask("safe_session", "../outside"), hasTaskError("TASK_VALIDATION_FAILED"));
  } finally {
    await removeRoot(rootDir);
  }
});

function hasTaskError(code: TaskSystemError["code"]): (error: unknown) => boolean {
  return (error: unknown): boolean => error instanceof TaskSystemError && error.code === code;
}
