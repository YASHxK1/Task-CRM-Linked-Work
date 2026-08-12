import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
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
type RelationshipType = (typeof relationshipTypeValues)[number];

function textFromResponse(response: Awaited<ReturnType<typeof invokeLLM>>) {
  const content = response.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

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

  assist: router({
    writeDescription: protectedProcedure.input(z.object({ title: z.string().min(1), notes: z.string().optional() })).mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You write concise, practical task descriptions. Return only the description in clear prose, with a short objective and useful acceptance criteria." },
          { role: "user", content: `Task title: ${input.title}\nAdditional notes: ${input.notes ?? "None"}` },
        ],
      });
      return { text: textFromResponse(response) };
    }),
    suggestLinks: protectedProcedure.input(z.object({ taskId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const task = await getTask(ctx.user.id, input.taskId);
      if (!task) throw new Error("Task not found");
      const candidates = (await listTasks(ctx.user.id)).filter(item => item.id !== task.id).slice(0, 50);
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a task relationship analyst. Suggest only clearly useful relationships from the provided candidates. Use only these relationship labels: blocks, is blocked by, relates to, duplicates, parent/child. Return JSON matching the requested schema." },
          { role: "user", content: JSON.stringify({ task, candidates }) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "task_link_suggestions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      taskId: { type: "integer" },
                      relationshipType: { type: "string", enum: relationshipTypeValues },
                      rationale: { type: "string" },
                    },
                    required: ["taskId", "relationshipType", "rationale"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        },
      });
      const raw = textFromResponse(response);
      try {
        const parsed = JSON.parse(raw) as { suggestions?: Array<{ taskId: number; relationshipType: RelationshipType; rationale: string }> };
        return { suggestions: (parsed.suggestions ?? []).filter(item => candidates.some(candidate => candidate.id === item.taskId)) };
      } catch {
        return { suggestions: [] as Array<{ taskId: number; relationshipType: RelationshipType; rationale: string }> };
      }
    }),
    summarizeChain: protectedProcedure.input(z.object({ taskId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const task = await getTask(ctx.user.id, input.taskId);
      if (!task) throw new Error("Task not found");
      const links = await listTaskLinks(ctx.user.id, input.taskId);
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Summarize the current state of this task chain for a busy operator. Mention blockers, next action, and risk. Keep it under 120 words." },
          { role: "user", content: JSON.stringify({ task, links }) },
        ],
      });
      return { text: textFromResponse(response) };
    }),
  }),
});

export type AppRouter = typeof appRouter;
