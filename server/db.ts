import { kv } from "@vercel/kv";
import {
  ActivityLog,
  Comment,
  InsertActivityLog,
  InsertComment,
  InsertTask,
  InsertTaskLink,
  Task,
  TaskLink,
} from "./schema";

const WORKSPACE_KEY = "task-crm:workspace";

type WorkspaceDoc = {
  tasks: Task[];
  taskLinks: TaskLink[];
  comments: Comment[];
  activityLogs: ActivityLog[];
  seq: { tasks: number; taskLinks: number; comments: number; activityLogs: number };
};

function emptyDoc(): WorkspaceDoc {
  return { tasks: [], taskLinks: [], comments: [], activityLogs: [], seq: { tasks: 0, taskLinks: 0, comments: 0, activityLogs: 0 } };
}

function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// Local fallback so the app (and tests) still work before a Vercel KV store is
// linked. Not shared across devices — use KV in production for cross-device
// persistence.
let memoryDoc: WorkspaceDoc | null = null;

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value : new Date(value as string | number);
}

function hydrateTask(task: Task): Task {
  return { ...task, dueDate: toDate(task.dueDate), createdAt: toDate(task.createdAt)!, updatedAt: toDate(task.updatedAt)! };
}

function hydrateLink(link: TaskLink): TaskLink {
  return { ...link, createdAt: toDate(link.createdAt)! };
}

function hydrateComment(comment: Comment): Comment {
  return { ...comment, createdAt: toDate(comment.createdAt)!, updatedAt: toDate(comment.updatedAt)! };
}

function hydrateActivity(activity: ActivityLog): ActivityLog {
  return { ...activity, createdAt: toDate(activity.createdAt)! };
}

async function getDoc(): Promise<WorkspaceDoc> {
  if (!kvConfigured()) {
    if (!memoryDoc) memoryDoc = emptyDoc();
    return memoryDoc;
  }
  const doc = await kv.get<WorkspaceDoc>(WORKSPACE_KEY);
  return doc ?? emptyDoc();
}

async function saveDoc(doc: WorkspaceDoc): Promise<void> {
  if (!kvConfigured()) {
    memoryDoc = doc;
    return;
  }
  await kv.set(WORKSPACE_KEY, doc);
}

export async function listTasks(ownerId: number, filters?: {
  status?: Task["status"];
  priority?: Task["priority"];
  due?: "overdue" | "upcoming";
  search?: string;
  linkedTaskId?: number;
  relationshipType?: TaskLink["relationshipType"];
}): Promise<Task[]> {
  const doc = await getDoc();
  let result = doc.tasks.filter(task => task.ownerId === ownerId);

  if (filters?.status) result = result.filter(task => task.status === filters.status);
  if (filters?.priority) result = result.filter(task => task.priority === filters.priority);

  const now = new Date();
  if (filters?.due === "overdue") result = result.filter(task => task.dueDate !== null && new Date(task.dueDate) < now && task.status !== "Done");
  if (filters?.due === "upcoming") result = result.filter(task => task.dueDate !== null && new Date(task.dueDate) >= now && task.status !== "Done");
  if (filters?.search) {
    const query = filters.search.toLowerCase();
    result = result.filter(task => task.title.toLowerCase().includes(query));
  }
  if (filters?.linkedTaskId || filters?.relationshipType) {
    const linked = doc.taskLinks.filter(link =>
      link.ownerId === ownerId &&
      (!filters.relationshipType || link.relationshipType === filters.relationshipType) &&
      (!filters.linkedTaskId || link.sourceTaskId === filters.linkedTaskId || link.targetTaskId === filters.linkedTaskId)
    );
    const ids = new Set(linked.flatMap(link => [link.sourceTaskId, link.targetTaskId]).filter(id => id !== filters.linkedTaskId));
    if (ids.size === 0) return [];
    result = result.filter(task => ids.has(task.id));
  }

  return result
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(hydrateTask);
}

export async function getTask(ownerId: number, taskId: number): Promise<Task | undefined> {
  const doc = await getDoc();
  const task = doc.tasks.find(item => item.ownerId === ownerId && item.id === taskId);
  return task ? hydrateTask(task) : undefined;
}

export async function createTask(values: InsertTask): Promise<Task> {
  const doc = await getDoc();
  const now = new Date();
  const task: Task = {
    id: ++doc.seq.tasks,
    ownerId: values.ownerId!,
    assigneeId: values.assigneeId ?? null,
    title: values.title!,
    description: values.description ?? null,
    status: values.status ?? "To Do",
    priority: values.priority ?? "Medium",
    dueDate: values.dueDate ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
  };
  doc.tasks.push(task);
  await saveDoc(doc);
  return hydrateTask(task);
}

export async function updateTask(ownerId: number, taskId: number, values: Partial<InsertTask>): Promise<Task> {
  const doc = await getDoc();
  const index = doc.tasks.findIndex(item => item.ownerId === ownerId && item.id === taskId);
  if (index === -1) throw new Error("Task not found");
  const updated: Task = { ...doc.tasks[index], ...values, id: taskId, ownerId, updatedAt: new Date() };
  doc.tasks[index] = updated;
  await saveDoc(doc);
  return hydrateTask(updated);
}

export async function deleteTask(ownerId: number, taskId: number): Promise<void> {
  const doc = await getDoc();
  doc.tasks = doc.tasks.filter(task => !(task.ownerId === ownerId && task.id === taskId));
  doc.taskLinks = doc.taskLinks.filter(link => !(link.sourceTaskId === taskId || link.targetTaskId === taskId));
  doc.comments = doc.comments.filter(comment => comment.taskId !== taskId);
  doc.activityLogs = doc.activityLogs.filter(activity => activity.taskId !== taskId);
  await saveDoc(doc);
}

export async function listTaskLinks(ownerId: number, taskId: number): Promise<Array<TaskLink & { task?: Task; direction: "outgoing" | "incoming" }>> {
  const doc = await getDoc();
  const links = doc.taskLinks
    .filter(link => link.ownerId === ownerId && (link.sourceTaskId === taskId || link.targetTaskId === taskId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(hydrateLink);
  return links.map(link => {
    const connectedId = link.sourceTaskId === taskId ? link.targetTaskId : link.sourceTaskId;
    const connected = doc.tasks.find(task => task.id === connectedId);
    return {
      ...link,
      task: connected ? hydrateTask(connected) : undefined,
      direction: link.sourceTaskId === taskId ? "outgoing" as const : "incoming" as const,
    };
  });
}

export async function createTaskLink(values: InsertTaskLink): Promise<TaskLink> {
  const doc = await getDoc();
  const link: TaskLink = {
    id: ++doc.seq.taskLinks,
    ownerId: values.ownerId!,
    sourceTaskId: values.sourceTaskId,
    targetTaskId: values.targetTaskId,
    relationshipType: values.relationshipType,
    createdBy: values.createdBy,
    createdAt: values.createdAt ?? new Date(),
  };
  doc.taskLinks.push(link);
  await saveDoc(doc);
  return hydrateLink(link);
}

export async function deleteTaskLink(ownerId: number, linkId: number): Promise<void> {
  const doc = await getDoc();
  doc.taskLinks = doc.taskLinks.filter(link => !(link.ownerId === ownerId && link.id === linkId));
  await saveDoc(doc);
}

export async function listComments(taskId: number): Promise<Comment[]> {
  const doc = await getDoc();
  return doc.comments
    .filter(comment => comment.taskId === taskId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(hydrateComment);
}

export async function createComment(values: InsertComment): Promise<Comment> {
  const doc = await getDoc();
  const now = new Date();
  const comment: Comment = {
    id: ++doc.seq.comments,
    taskId: values.taskId,
    authorId: values.authorId,
    content: values.content,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
  };
  doc.comments.push(comment);
  await saveDoc(doc);
  return hydrateComment(comment);
}

export async function createActivity(values: InsertActivityLog): Promise<ActivityLog> {
  const doc = await getDoc();
  const activity: ActivityLog = {
    id: ++doc.seq.activityLogs,
    taskId: values.taskId,
    actorId: values.actorId,
    eventType: values.eventType,
    message: values.message,
    metadata: values.metadata ?? null,
    createdAt: values.createdAt ?? new Date(),
  };
  doc.activityLogs.push(activity);
  await saveDoc(doc);
  return hydrateActivity(activity);
}

export async function listActivity(taskId: number): Promise<ActivityLog[]> {
  const doc = await getDoc();
  return doc.activityLogs
    .filter(activity => activity.taskId === taskId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(hydrateActivity);
}

export async function getDashboard(ownerId: number): Promise<{
  counts: { "To Do": number; "In Progress": number; Done: number; Blocked: number };
  overdue: Task[];
  recent: Task[];
}> {
  const allTasks = await listTasks(ownerId);
  const counts = {
    "To Do": allTasks.filter(task => task.status === "To Do").length,
    "In Progress": allTasks.filter(task => task.status === "In Progress").length,
    Done: allTasks.filter(task => task.status === "Done").length,
    Blocked: allTasks.filter(task => task.status === "Blocked").length,
  };
  const overdue = allTasks.filter(task => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "Done").slice(0, 5);
  const recent = allTasks.slice(0, 6);
  return { counts, overdue, recent };
}
