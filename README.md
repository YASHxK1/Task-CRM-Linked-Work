# Task CRM — Linked Work

A task management app with linkable tasks. Track work items across a dashboard, a Kanban board, and a filterable table — then connect tasks to each other (blocks / is blocked by / relates to / duplicates / parent-child).

A brutalist black-and-white UI, built on React 19 + Vite with a tRPC + Drizzle backend. Single-user workspace: no login, no external service dependencies.

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
| Backend | Node.js, Express, tRPC 11, Zod, Drizzle ORM (mysql2) |
| Database | MySQL |
| Auth | None — single-user workspace (seeded owner/admin account) |
| Testing | Vitest |

## Getting started

```bash
pnpm install
pnpm dev        # start the dev server (Vite + tRPC API)
```

The dev server starts on `http://localhost:3000/` (falls back to a free port if busy).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | MySQL connection string |
| `PORT` | no | Server port (default 3000) |

## Deploying to Render

This repo ships a `Dockerfile` (multi-stage: builds with Vite + esbuild, runs
with production deps only) and a `render.yaml` blueprint.

**On Render (recommended):** push this repo to GitHub, then in Render choose
*New → Blueprint* and point it at this repo. It provisions the MySQL database
and web service, and auto-applies the schema + seed on container start.

**Or manually:** create a *Web Service* from the repo with `Runtime: Docker`.
Attach a Render MySQL database and set `DATABASE_URL` to its connection string.

The container runs `node dist/ensureSchema.js` before starting the server; this
creates the tables (`CREATE TABLE IF NOT EXISTS`) and seeds the owner/admin
user so a fresh deploy works with no manual DB setup. The schema is read from
`drizzle/schema.ts` — if you add tables, update `drizzle/bootstrap.sql` too.

## Database

Migrations live in `drizzle/`. Apply them with:

```bash
pnpm db:push
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run the dev server with hot reload |
| `pnpm build` | Build the client (Vite) and bundle the server (esbuild) into `dist/` |
| `pnpm start` | Run the production server (`NODE_ENV=production`) |
| `pnpm check` | Type-check the project (`tsc --noEmit`) |
| `pnpm test` | Run the Vitest test suite |
| `pnpm format` | Format the codebase with Prettier |
| `pnpm db:push` | Generate and apply database migrations |

## Project layout

```
client/    React frontend (Vite)
server/    Express + tRPC backend
shared/    Shared constants and types between client and server
drizzle/   Database schema, migrations, and the bootstrap SQL
```

## License

MIT