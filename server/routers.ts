import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  createActivity,
  createComment,
  createTask,
  createTaskLink,
  deleteTask,
  deleteTaskLink,
  getDashboard,
  getTask,
  listActivity,
  listComments,
  listTaskLinks,
  listTasks,
  updateTask,
} from "./db";
import { activityEventValues, relationshipTypeValues, taskPriorityValues, taskStatusValues } from "../drizzle/schema";

const taskStatus = z.enum(taskStatusValues);
const taskPriority = z.enum(taskPriorityValues);
const relationshipType = z.enum(relationshipTypeValues);

export const appRouter = router({
  task: router({
    list: protectedProcedure.input(z.object({
      status: taskStatus.optional(),
      priority: taskPriority.optional(),
      due: z.enum(["overdue", "upcoming"]).optional(),
      search: z.string().optional(),
      linkedTaskId: z.number().int().positive().optional(),
      relationshipType: relationshipType.optional(),
    }).optional()).query(({ ctx, input }) => listTasks(ctx.user.id, input)),
    dashboard: protectedProcedure.query(({ ctx }) => getDashboard(ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const task = await getTask(ctx.user.id, input.id);
      if (!task) return null;
      const [links, comments, activity] = await Promise.all([
        listTaskLinks(ctx.user.id, input.id),
        listComments(input.id),
        listActivity(input.id),
      ]);
      return { task, links, comments, activity };
    }),
    create: protectedProcedure.input(z.object({
      title: z.string().trim().min(1).max(255),
      description: z.string().trim().max(10000).optional(),
      status: taskStatus.default("To Do"),
      priority: taskPriority.default("Medium"),
      dueDate: z.coerce.date().nullable().optional(),
      assigneeId: z.number().int().positive().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      const task = await createTask({
        ownerId: ctx.user.id,
        assigneeId: input.assigneeId ?? null,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate ?? null,
      });
      await createActivity({ taskId: task.id, actorId: ctx.user.id, eventType: "edit", message: "Created this task.", metadata: { action: "created" } });
      return task;
    }),
    update: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      title: z.string().trim().min(1).max(255).optional(),
      description: z.string().trim().max(10000).nullable().optional(),
      status: taskStatus.optional(),
      priority: taskPriority.optional(),
      dueDate: z.coerce.date().nullable().optional(),
      assigneeId: z.number().int().positive().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      const before = await getTask(ctx.user.id, input.id);
      if (!before) throw new Error("Task not found");
      const { id, ...values } = input;
      const after = await updateTask(ctx.user.id, id, values);
      if (input.status && input.status !== before.status) {
        await createActivity({ taskId: id, actorId: ctx.user.id, eventType: "status_change", message: `Moved from ${before.status} to ${input.status}.`, metadata: { from: before.status, to: input.status } });
      }
      const hasEdit = Object.keys(values).some(key => key !== "status");
      if (hasEdit) await createActivity({ taskId: id, actorId: ctx.user.id, eventType: "edit", message: "Edited task details.", metadata: { fields: Object.keys(values).filter(key => key !== "status") } });
      return after;
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const task = await getTask(ctx.user.id, input.id);
      if (!task) throw new Error("Task not found");
      await deleteTask(ctx.user.id, input.id);
      return { success: true } as const;
    }),
    addLink: protectedProcedure.input(z.object({
      sourceTaskId: z.number().int().positive(),
      targetTaskId: z.number().int().positive(),
      relationshipType,
    })).mutation(async ({ ctx, input }) => {
      if (input.sourceTaskId === input.targetTaskId) throw new Error("A task cannot link to itself");
      const [source, target] = await Promise.all([getTask(ctx.user.id, input.sourceTaskId), getTask(ctx.user.id, input.targetTaskId)]);
      if (!source || !target) throw new Error("Both tasks must belong to your workspace");
      const link = await createTaskLink({ ownerId: ctx.user.id, sourceTaskId: source.id, targetTaskId: target.id, relationshipType: input.relationshipType, createdBy: ctx.user.id });
      await createActivity({ taskId: source.id, actorId: ctx.user.id, eventType: "link_created", message: `${input.relationshipType} ${target.title}.`, metadata: { targetTaskId: target.id, relationshipType: input.relationshipType } });
      await createActivity({ taskId: target.id, actorId: ctx.user.id, eventType: "link_created", message: `${input.relationshipType} ${source.title}.`, metadata: { sourceTaskId: source.id, relationshipType: input.relationshipType } });
      return link;
    }),
    removeLink: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await deleteTaskLink(ctx.user.id, input.id);
      return { success: true } as const;
    }),
    comment: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), content: z.string().trim().min(1).max(5000) })).mutation(async ({ ctx, input }) => {
      const task = await getTask(ctx.user.id, input.taskId);
      if (!task) throw new Error("Task not found");
      const comment = await createComment({ taskId: input.taskId, authorId: ctx.user.id, content: input.content });
      await createActivity({ taskId: input.taskId, actorId: ctx.user.id, eventType: "comment", message: "Added a comment.", metadata: { commentId: comment.id } });
      return comment;
    }),
  }),
});

export type AppRouter = typeof appRouter;