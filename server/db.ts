import { and, asc, desc, eq, gte, lte, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  ActivityLog,
  Comment,
  InsertActivityLog,
  InsertComment,
  InsertTask,
  InsertTaskLink,
  InsertUser,
  Task,
  TaskLink,
  User,
  activityLogs,
  comments,
  taskLinks,
  tasks,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: typeof user = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listTasks(ownerId: number, filters?: {
  status?: Task["status"];
  priority?: Task["priority"];
  due?: "overdue" | "upcoming";
  search?: string;
  linkedTaskId?: number;
  relationshipType?: TaskLink["relationshipType"];
}) {
  const db = await getDb();
  if (!db) return [] as Task[];
  const conditions = [eq(tasks.ownerId, ownerId)];
  if (filters?.status) conditions.push(eq(tasks.status, filters.status));
  if (filters?.priority) conditions.push(eq(tasks.priority, filters.priority));
  if (filters?.due === "overdue") conditions.push(and(lte(tasks.dueDate, new Date()), ne(tasks.status, "Done"))!);
  if (filters?.due === "upcoming") conditions.push(and(gte(tasks.dueDate, new Date()), ne(tasks.status, "Done"))!);
  if (filters?.search) conditions.push(sql`LOWER(${tasks.title}) LIKE ${`%${filters.search.toLowerCase()}%`}`);
  if (filters?.linkedTaskId || filters?.relationshipType) {
    const linkConditions = [eq(taskLinks.ownerId, ownerId)];
    if (filters.relationshipType) linkConditions.push(eq(taskLinks.relationshipType, filters.relationshipType));
    if (filters.linkedTaskId) linkConditions.push(or(eq(taskLinks.sourceTaskId, filters.linkedTaskId), eq(taskLinks.targetTaskId, filters.linkedTaskId))!);
    const linked = await db.select({ sourceTaskId: taskLinks.sourceTaskId, targetTaskId: taskLinks.targetTaskId })
      .from(taskLinks)
      .where(and(...linkConditions));
    const ids = linked.flatMap(item => [item.sourceTaskId, item.targetTaskId]).filter(id => id !== filters.linkedTaskId);
    if (!ids.length) return [] as Task[];
    conditions.push(sql`${tasks.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
  }
  return db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.updatedAt));
}

export async function getTask(ownerId: number, taskId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tasks).where(and(eq(tasks.ownerId, ownerId), eq(tasks.id, taskId))).limit(1);
  return result[0];
}

export async function createTask(values: InsertTask): Promise<Task> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(tasks).values(values);
  const created = await db.select().from(tasks).where(eq(tasks.id, result[0].insertId)).limit(1);
  if (!created[0]) throw new Error("Task was not created");
  return created[0];
}

export async function updateTask(ownerId: number, taskId: number, values: Partial<InsertTask>): Promise<Task> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(tasks).set(values).where(and(eq(tasks.ownerId, ownerId), eq(tasks.id, taskId)));
  const updated = await getTask(ownerId, taskId);
  if (!updated) throw new Error("Task not found");
  return updated;
}

export async function deleteTask(ownerId: number, taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(activityLogs).where(eq(activityLogs.taskId, taskId));
  await db.delete(comments).where(eq(comments.taskId, taskId));
  await db.delete(taskLinks).where(or(eq(taskLinks.sourceTaskId, taskId), eq(taskLinks.targetTaskId, taskId)));
  await db.delete(tasks).where(and(eq(tasks.ownerId, ownerId), eq(tasks.id, taskId)));
}

export async function listTaskLinks(ownerId: number, taskId: number) {
  const db = await getDb();
  if (!db) return [];
  const links = await db.select().from(taskLinks).where(and(eq(taskLinks.ownerId, ownerId), or(eq(taskLinks.sourceTaskId, taskId), eq(taskLinks.targetTaskId, taskId)))).orderBy(desc(taskLinks.createdAt));
  const connectedIds = links.map(link => link.sourceTaskId === taskId ? link.targetTaskId : link.sourceTaskId);
  const connected = connectedIds.length ? await db.select().from(tasks).where(sql`${tasks.id} IN (${sql.join(connectedIds.map(id => sql`${id}`), sql`, `)})`) : [];
  return links.map(link => ({
    ...link,
    task: connected.find(item => item.id === (link.sourceTaskId === taskId ? link.targetTaskId : link.sourceTaskId)),
    direction: link.sourceTaskId === taskId ? "outgoing" : "incoming" as const,
  }));
}

export async function createTaskLink(values: InsertTaskLink): Promise<TaskLink> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(taskLinks).values(values);
  const created = await db.select().from(taskLinks).where(eq(taskLinks.id, result[0].insertId)).limit(1);
  if (!created[0]) throw new Error("Link was not created");
  return created[0];
}

export async function deleteTaskLink(ownerId: number, linkId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(taskLinks).where(and(eq(taskLinks.ownerId, ownerId), eq(taskLinks.id, linkId)));
}

export async function listComments(taskId: number) {
  const db = await getDb();
  if (!db) return [] as Comment[];
  return db.select().from(comments).where(eq(comments.taskId, taskId)).orderBy(asc(comments.createdAt));
}

export async function createComment(values: InsertComment): Promise<Comment> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(comments).values(values);
  const created = await db.select().from(comments).where(eq(comments.id, result[0].insertId)).limit(1);
  if (!created[0]) throw new Error("Comment was not created");
  return created[0];
}

export async function createActivity(values: InsertActivityLog): Promise<ActivityLog> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(activityLogs).values(values);
  const created = await db.select().from(activityLogs).where(eq(activityLogs.id, result[0].insertId)).limit(1);
  if (!created[0]) throw new Error("Activity was not created");
  return created[0];
}

export async function listActivity(taskId: number) {
  const db = await getDb();
  if (!db) return [] as ActivityLog[];
  return db.select().from(activityLogs).where(eq(activityLogs.taskId, taskId)).orderBy(desc(activityLogs.createdAt));
}

export async function getDashboard(ownerId: number) {
  const db = await getDb();
  if (!db) return { counts: { "To Do": 0, "In Progress": 0, Done: 0, Blocked: 0 }, overdue: [], recent: [] };
  const allTasks = await listTasks(ownerId);
  const counts = {
    "To Do": allTasks.filter(task => task.status === "To Do").length,
    "In Progress": allTasks.filter(task => task.status === "In Progress").length,
    Done: allTasks.filter(task => task.status === "Done").length,
    Blocked: allTasks.filter(task => task.status === "Blocked").length,
  };
  const overdue = allTasks.filter(task => task.dueDate && task.dueDate < new Date() && task.status !== "Done").slice(0, 5);
  const recent = allTasks.slice(0, 6);
  return { counts, overdue, recent };
}
