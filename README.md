# Task CRM — Linked Work

A task management app with intelligent, linkable tasks. Track work items across a dashboard, a Kanban board, and a filterable table — then connect tasks to each other (blocks / is blocked by / relates to / duplicates / parent-child) and let an LLM help you write descriptions, suggest relationships, and summarize task chains.

A brutalist black-and-white UI, built on React 19 + Vite with a tRPC + Drizzle backend.

## Features

- **Dashboard** — task counts by status, overdue tasks, recently updated items
- **Kanban board** — drag-and-drop-style status toggling with search and priority filters
- **List / table view** — advanced filtering by status, priority, due date, and relationships
- **Task detail** — rich fields (title, description, due date, assignee, status, priority) plus comments and a full activity log (status changes, links, comments, edits)
- **Task linking** — define `blocks`, `is blocked by`, `relates to`, `duplicates`, and `parent/child` relationships with quick-link search
- **LLM assistance** — write descriptions, suggest actionable links, and summarize task chains (via the Manus Forge API)

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS 4, shadcn/ui (Radix), TanStack Query, wouter, recharts, framer-motion |
| Backend | Node.js, Express, tRPC 11, Zod, Drizzle ORM (mysql2) |
| Database | MySQL |
| Auth | Manus platform OAuth + signed JWT session cookies (jose) |
| LLM / integrations | Manus Forge API (LLM, notifications, storage proxy) |
| Testing | Vitest |

## Getting started

```bash
pnpm install
pnpm dev        # start the dev server (Vite + tRPC API)
```

The dev server starts on `http://localhost:3000/` (falls back to a free port if busy).

## Environment variables

Copy the required variables into a `.env` file (see `server/_core/env.ts` for how they are read).

| Variable | Required | Purpose |
|---|---|---|
| `VITE_APP_ID` | yes | Manus OAuth app id |
| `VITE_OAUTH_PORTAL_URL` | yes | OAuth sign-in portal URL |
| `OAUTH_SERVER_URL` | yes | Manus OAuth token/userinfo endpoint |
| `JWT_SECRET` | yes | Secret used to sign session cookies |
| `DATABASE_URL` | yes | MySQL connection string |
| `OWNER_OPEN_ID` | no | OpenID of the admin/owner |
| `BUILT_IN_FORGE_API_URL` | for LLM features | Forge API base URL |
| `BUILT_IN_FORGE_API_KEY` | for LLM features | Forge API key |
| `PORT` | no | Server port (default 3000) |

> This app is designed to run on the Manus platform. OAuth login, LLM assistance, notifications, and the storage proxy depend on external Manus services — they will not work without the credentials above.

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
drizzle/   Database schema and migrations
```

## License

MIT