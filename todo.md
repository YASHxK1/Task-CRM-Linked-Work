# Project TODO

- [x] Initialize database schema with tables for tasks, task_links, comments, and activity_logs
- [x] Create tRPC routers for tasks, links, comments, activity logs, and LLM assistance
- [x] Implement Brutalist UI design system in index.css (stark black/white, oversized bold typography, high-contrast borders)
- [x] Build Dashboard overview (task counts by status, overdue tasks, recently updated items)
- [x] Build Kanban board view with drag-and-drop / status toggling and filtering
- [x] Build List/Table view with advanced filtering by status, priority, due date, and relationships
- [x] Build Task Detail drawer/page with rich fields, comments, and activity log tracking all 4 event types
- [x] Build Intelligent Task Linking system (blocks, is blocked by, relates to, duplicates, parent/child) with quick-link search
- [x] Build LLM-powered assistance for writing descriptions, suggesting links, and summarizing task chains
- [x] Write Vitest unit tests for core backend procedures and task linking logic
- [x] Save project checkpoint and complete available readiness checks (TypeScript, Vitest, preview verified; Vite production bundle remains blocked by sandbox memory pressure)

- [x] Add explicit loading and error states for dashboard, board, table, and task-detail data queries
- [x] Add board-level search and priority filtering plus a specific connected-task target filter for the table
- [x] Expand the task detail drawer to show and edit title, description, due date, assignee, status, and priority
- [x] Make AI link suggestions actionable with direct CONNECT controls and visible loading/error feedback
- [x] Expand Vitest coverage for task CRUD, dashboard metrics, comments, activity logging, filtering, and LLM description output
