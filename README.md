# Task CRM — Linked Work

A task management app with intelligent, linkable tasks. Track work items across a dashboard, a Kanban board, and a filterable table — then connect tasks to each other (blocks / is blocked by / relates to / duplicates / parent-child) and watch the dependency chain grow.

A brutalist black-and-white UI, built on React 19 + Vite with a tRPC backend, deployed on **Vercel** with **Vercel KV** for persistence.

## Features

- **Dashboard** — task counts by status, overdue tasks, recently updated items
- **Kanban board** — drag-and-drop-style status toggling with search and priority filters
- **List / table view** — advanced filtering by status, priority, due date, and relationships
- **Task detail** — rich fields (title, description, due date, assignee, status, priority) plus comments and a full activity log (status changes, links, comments, edits)
- **Task linking** — define `blocks`, `is blocked by`, `relates to`, `duplicates`, and `parent/child` relationships with quick-link search

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS 4, shadcn/ui (Radix), TanStack Query, wouter, recharts, framer-motion |
| Backend (Vercel) | tRPC 11, Zod, superjson — Vercel Node serverless functions (`api/trpc/[...trpc].ts`) |
| Database | Vercel KV (Upstash Redis) — single-user workspace stored as a JSON document |
| Auth | None — single-user workspace, no login |
| Testing | Vitest |

## Getting started

```bash
pnpm install
pnpm dev        # start the local dev server (Vite + tRPC API)
```

The dev server starts on `http://localhost:3000/` (falls back to a free port if busy).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `KV_REST_API_URL` | for cross-device persistence | Vercel KV REST endpoint (auto-injected when you link a KV store) |
| `KV_REST_API_TOKEN` | for cross-device persistence | Vercel KV REST token (auto-injected when you link a KV store) |
| `PORT` | no | Local server port (default 3000) |

> Without `KV_REST_API_URL`/`KV_REST_API_TOKEN` the app falls back to an in-memory store: great for local development and tests, but data is lost on restart and not shared across devices. Link a Vercel KV store to get real cross-device persistence.

## Database

The whole single-user workspace (tasks, links, comments, activity log) lives under one JSON document in Vercel KV, so a single read/write is atomic and works from any device. No schema migrations are needed — the document shape is defined in `server/schema.ts` and read/written in `server/db.ts`.

## Deployment (Vercel)

1. Push this repository to GitHub.
2. Import it into Vercel. `vercel.json` already configures the build (`vite build`) and the static output directory, plus an SPA rewrite for client-side routes (`/board`, `/tasks`).
3. The API runs as the serverless function at `api/trpc/[...trpc].ts` (serving `/api/trpc`).
4. Create a **Vercel KV** store in the project dashboard and link it to the project. Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically — no manual config needed.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run the local dev server with hot reload (Vite + tRPC) |
| `pnpm build` | Build the client (Vite) into `dist/public` |
| `pnpm start` | Serve the built client + API locally (production mode preview) |
| `pnpm check` | Type-check the project (`tsc --noEmit`) |
| `pnpm test` | Run the Vitest test suite |
| `pnpm format` | Format the codebase with Prettier |

## Project layout

```
api/       Vercel serverless function (tRPC catch-all)
client/    React frontend (Vite)
server/    tRPC routers, KV data layer, schema
shared/    Shared constants and types between client and server
```

## License

MIT