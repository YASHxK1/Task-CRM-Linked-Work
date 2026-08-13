import { describe, expect, it, vi } from "vitest";
import { relationshipTypeValues, taskStatusValues } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  createActivity: vi.fn(async (values: Record<string, unknown>) => ({ id: 1, ...values, createdAt: new Date() })),
  createComment: vi.fn(async (values: Record<string, unknown>) => ({ id: 21, ...values, createdAt: new Date(), updatedAt: new Date() })),
  createTask: vi.fn(async (values: Record<string, unknown>) => ({ id: 11, ...values, createdAt: new Date(), updatedAt: new Date() })),
  createTaskLink: vi.fn(async (values: Record<string, unknown>) => ({ id: 10, ...values, createdAt: new Date() })),
  deleteTask: vi.fn(async () => undefined),
  deleteTaskLink: vi.fn(async () => undefined),
  getDashboard: vi.fn(async () => ({ counts: { "To Do": 1, "In Progress": 2, Done: 3, Blocked: 4 }, overdue: [], recent: [] })),
  getTask: vi.fn(async (_ownerId: number, id: number) => ({
    id,
    ownerId: 42,
    title: id === 1 ? "Ship the release" : "Run acceptance checks",
    description: null,
    status: "To Do",
    priority: "High",
    dueDate: null,
    assigneeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  listActivity: vi.fn(async () => []),
  listComments: vi.fn(async () => []),
  listTaskLinks: vi.fn(async () => []),
  listTasks: vi.fn(async () => []),
  updateTask: vi.fn(async (_ownerId: number, id: number, values: Record<string, unknown>) => ({
    id,
    ownerId: 42,
    title: "Ship the release",
    description: null,
    status: values.status ?? "To Do",
    priority: values.priority ?? "High",
    dueDate: null,
    assigneeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
}));

import { appRouter } from "./routers";
import { createActivity, createComment, createTask, createTaskLink, getDashboard, listTasks, updateTask } from "./db";

function createContext(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "task-crm-test",
      email: "test@example.com",
      name: "Task CRM Test",
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("Task CRM relationship contracts", () => {
  it("preserves the required status labels", () => {
    expect(taskStatusValues).toEqual(["To Do", "In Progress", "Done", "Blocked"]);
  });

  it("preserves the required relationship labels", () => {
    expect(relationshipTypeValues).toEqual(["blocks", "is blocked by", "relates to", "duplicates", "parent/child"]);
  });

  it("creates a task and logs its edit activity", async () => {
    const caller = appRouter.createCaller(createContext());
    const task = await caller.task.create({ title: "Write the release brief", priority: "High" });
    expect(task.id).toBe(11);
    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 42, title: "Write the release brief", status: "To Do", priority: "High" }));
    expect(createActivity).toHaveBeenCalledWith(expect.objectContaining({ taskId: 11, eventType: "edit" }));
  });

  it("updates status and records a status-change event", async () => {
    vi.mocked(createActivity).mockClear();
    const caller = appRouter.createCaller(createContext());
    await caller.task.update({ id: 1, status: "In Progress" });
    expect(updateTask).toHaveBeenCalledWith(42, 1, { status: "In Progress" });
    expect(createActivity).toHaveBeenCalledWith(expect.objectContaining({ eventType: "status_change", taskId: 1 }));
  });

  it("creates a link and records activity on both connected tasks", async () => {
    vi.mocked(createActivity).mockClear();
    const caller = appRouter.createCaller(createContext());
    await caller.task.addLink({ sourceTaskId: 1, targetTaskId: 2, relationshipType: "blocks" });
    expect(createTaskLink).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 42, sourceTaskId: 1, targetTaskId: 2, relationshipType: "blocks", createdBy: 42 }));
    expect(createActivity).toHaveBeenCalledTimes(2);
    expect(createActivity).toHaveBeenCalledWith(expect.objectContaining({ eventType: "link_created", taskId: 1 }));
    expect(createActivity).toHaveBeenCalledWith(expect.objectContaining({ eventType: "link_created", taskId: 2 }));
  });

  it("rejects self-links", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.task.addLink({ sourceTaskId: 1, targetTaskId: 1, relationshipType: "relates to" })).rejects.toThrow("cannot link to itself");
  });

  it("creates a comment and logs a comment event", async () => {
    vi.mocked(createActivity).mockClear();
    const caller = appRouter.createCaller(createContext());
    const result = await caller.task.comment({ taskId: 1, content: "Acceptance criteria confirmed." });
    expect(result.id).toBe(21);
    expect(createComment).toHaveBeenCalledWith(expect.objectContaining({ taskId: 1, authorId: 42, content: "Acceptance criteria confirmed." }));
    expect(createActivity).toHaveBeenCalledWith(expect.objectContaining({ eventType: "comment", taskId: 1 }));
  });

  it("returns dashboard metrics through the protected procedure", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.task.dashboard();
    expect(getDashboard).toHaveBeenCalledWith(42);
    expect(result.counts.Blocked).toBe(4);
  });

  it("passes relationship filters through the list contract", async () => {
    const caller = appRouter.createCaller(createContext());
    await caller.task.list({ status: "Blocked", relationshipType: "blocks" });
    expect(listTasks).toHaveBeenCalledWith(42, expect.objectContaining({ status: "Blocked", relationshipType: "blocks" }));
  });
});
