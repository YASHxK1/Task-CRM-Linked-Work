export const taskStatusValues = ["To Do", "In Progress", "Done", "Blocked"] as const;
export const taskPriorityValues = ["Low", "Medium", "High", "Urgent"] as const;
export const relationshipTypeValues = [
  "blocks",
  "is blocked by",
  "relates to",
  "duplicates",
  "parent/child",
] as const;
export const activityEventValues = ["status_change", "link_created", "comment", "edit"] as const;

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

export type InsertUser = Partial<Omit<User, "id">> & { openId: string };

export type Task = {
  id: number;
  ownerId: number;
  assigneeId: number | null;
  title: string;
  description: string | null;
  status: (typeof taskStatusValues)[number];
  priority: (typeof taskPriorityValues)[number];
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertTask = Partial<Omit<Task, "id">>;

export type TaskLink = {
  id: number;
  ownerId: number;
  sourceTaskId: number;
  targetTaskId: number;
  relationshipType: (typeof relationshipTypeValues)[number];
  createdBy: number;
  createdAt: Date;
};

export type InsertTaskLink = Partial<Omit<TaskLink, "id">> & {
  sourceTaskId: number;
  targetTaskId: number;
  relationshipType: TaskLink["relationshipType"];
  createdBy: number;
};

export type Comment = {
  id: number;
  taskId: number;
  authorId: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertComment = Partial<Omit<Comment, "id">> & {
  taskId: number;
  authorId: number;
  content: string;
};

export type ActivityLog = {
  id: number;
  taskId: number;
  actorId: number;
  eventType: (typeof activityEventValues)[number];
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

export type InsertActivityLog = Partial<Omit<ActivityLog, "id">> & {
  taskId: number;
  actorId: number;
  eventType: ActivityLog["eventType"];
  message: string;
};
