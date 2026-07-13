# Task Manager Project Context For Codex

Use this file as the first context file when reopening the project. It captures the current app structure, runtime assumptions, data model, product behavior, and handoff notes for this workspace.

## Workspace

- Current workspace: `c:\Users\Admin\.gemini\antigravity\scratch\task-manager`
- Product name in UI: `AI TASK`
- Main app: Next.js App Router app under `src/app`
- Local data folder: `data/`
- SQLite database: `data/task-manager.db`
- Portable package output: `dist/AI-TASK-Portable.zip`

## Critical Local Instructions

- Read `AGENTS.md` before editing. This project uses a newer Next.js with breaking changes.
- Before changing Next.js app or API route code, inspect the relevant local docs under `node_modules/next/dist/docs/`.
- Next 16 docs checked for current structure:
  - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
- Dynamic route handlers use `RouteContext` and await `context.params`.
- API routes that use SQLite or filesystem must keep `export const runtime = 'nodejs'`.
- User-facing communication should normally be Vietnamese.
- Keep UI dense, practical, and task-focused. Avoid marketing-style layouts.
- Use existing Neo Mint tokens from `src/styles/neoMintTokens.ts`.
- Do not overwrite user data in `data/task-manager.db`.
- Do not rebuild `dist/` or portable output unless explicitly needed.

## Commands

```powershell
npm run dev
npm run lint
npm run build
npm run package:portable
```

`npm run package:portable` runs `scripts/package-portable.ps1` and builds the Windows portable package with local `node.exe`, app files, and `Run AI TASK.bat`.

## Technology Stack

- Next.js `16.2.6`
- React `19.2.4`
- TypeScript `^5`
- MUI `9.0.1`
- MUI X Data Grid `9.1.0`
- MUI App Router cache provider package `@mui/material-nextjs`
- Emotion `11.x`
- SQLite via `better-sqlite3`
- CSV import/export via `papaparse`
- Gemini integration via `@google/generative-ai`
- Rich text editor dependency: `react-quill-new`
- Date utilities: `date-fns`
- Tailwind package is installed, but the current UI is primarily MUI plus CSS variables.

## Current Top-Level Structure

```text
.
|-- src/
|   |-- app/
|   |   |-- layout.tsx
|   |   |-- page.tsx
|   |   |-- globals.css
|   |   `-- api/
|   |       |-- assistant-query/route.ts
|   |       |-- database-csv/route.ts
|   |       |-- extract-task/route.ts
|   |       |-- notebooks/route.ts
|   |       |-- notebooks/[id]/route.ts
|   |       |-- notebooks/[id]/activate/route.ts
|   |       |-- settings/route.ts
|   |       `-- tasks/route.ts
|   |-- components/
|   |-- styles/
|   |-- types/
|   `-- utils/
|-- data/
|-- scripts/
|-- skills/
|-- public/
|-- dist/
|-- PROJECT_CONTEXT_FOR_CODEX.md
|-- package.json
|-- next.config.ts
`-- tsconfig.json
```

Generated or local artifacts include `.next/`, `dist/`, `tmp-screenshots/`, `next-dev-*.log`, SQLite WAL/SHM files, and `tsconfig.tsbuildinfo`.

## App Entry Points

- `src/app/layout.tsx`: root layout, imports `globals.css`, loads Inter font, wraps the app with `AppRouterCacheProvider` from `@mui/material-nextjs/v16-appRouter` and local `ThemeProvider`.
- `src/app/page.tsx`: main client-side shell. Loads notebooks, activates `?notebookId=`, fetches tasks/settings, owns dialog state, sidebar width, filters, and save orchestration.
- `src/app/globals.css`: global CSS variables and base styling for the Neo Mint UI.
- `src/styles/neoMintTokens.ts`: shared design tokens used by components.

## UI Components

- `src/components/TaskList.tsx`: MUI DataGrid task table, filtering result display, show/hide completed toggle, bulk actions, status editing, drag reorder within a status, progress column, due-date change badge.
- `src/components/FilterPanel.tsx`: sidebar filters. Exports `FilterState` and `INITIAL_FILTERS`.
- `src/components/AddTaskDialog.tsx`: create tasks manually or from AI-extracted text. `skipAI` switches to manual entry mode.
- `src/components/TaskDetailDialog.tsx`: task editor, rich details, tags, assignee, dates, notes, subtasks, manual progress when there are no subtasks.
- `src/components/TaskAssistantPanel.tsx`: natural-language assistant panel, quick configured intents, and related task click-through.
- `src/components/TaskMindmapDialog.tsx`: full-screen mindmap view, tag/task/subtask nodes, localStorage state per notebook, task details handoff, completed filtering.
- `src/components/NotebookDialog.tsx`: create, open, rename, delete notebooks.
- `src/components/SettingsDialog.tsx`: Gemini key, notebook tags, advanced assistant intent configuration, full database CSV import/export.
- `src/components/ThemeProvider.tsx`: local theme context provider.

## API Routes

All current API route handlers are App Router `route.ts` files and use Node runtime where needed.

- `GET/POST /api/tasks`: reads/writes notebook-scoped task lists through `taskRepository`.
- `GET/POST /api/settings`: reads/writes settings for a notebook. API key is global, tags/intents are notebook-scoped.
- `GET/POST /api/notebooks`: lists notebooks and creates a notebook.
- `PATCH/DELETE /api/notebooks/[id]`: renames or deletes a notebook.
- `POST /api/notebooks/[id]/activate`: marks notebook as active and updates `last_accessed_at`.
- `POST /api/extract-task`: uses Gemini to parse free text into task objects.
- `POST /api/assistant-query`: answers user questions using configured intents, deterministic task queries, or a guarded SQL planner fallback.
- `GET/POST /api/database-csv`: exports/imports the whole database as CSV.

## Utilities

- `src/utils/db.ts`: opens `better-sqlite3`, ensures `data/`, enables foreign keys and WAL, initializes schema and migrations.
- `src/utils/notebooks.ts`: notebook CRUD, active notebook resolution, default notebook, seeded notebook settings.
- `src/utils/taskRepository.ts`: SQLite task read/write, subtasks/tags/history persistence, sort order normalization, legacy CSV migration guard.
- `src/utils/settings.ts`: global Gemini API key plus notebook-scoped tags and assistant intents.
- `src/utils/databaseCsv.ts`: full database CSV export/import for notebooks, tasks, subtasks, tags, settings, and history.
- `src/utils/csv.ts`: legacy CSV task helpers; mostly retained for migration/backward compatibility.
- `src/utils/taskProgress.ts`: manual progress options and subtask-derived progress/status rules.
- `src/utils/taskTimestamps.ts`: applies status transition timestamps before saving.
- `src/utils/taskOrdering.ts`: status ordering, priority sorting, task reorder within status, subtask sort normalization.
- `src/utils/assistantQueries.ts`: deterministic assistant intents and fallback intent parsing.
- `src/utils/assistantSqlPlanner.ts`: validates and executes read-only Gemini-planned SQL against a whitelisted schema.

## Data Model

Primary TypeScript types live in `src/types/index.ts`.

- `TaskStatus`: `URGENT`, `IN PROGRESS`, `TO DO`, `PENDING`, `CANCELLED`, `DONE`
- `AssistantIntent`: configured and inferred query intents, plus `UNKNOWN`
- `Subtask`: `id`, `title`, `completed`, optional `sortOrder`
- `Task`: id, timestamps, title/details, assignee, tags, status, progress, optional `sortOrder`, start/due dates, due-date change count, notes, subtasks
- `Notebook`: `id`, `name`, `createdAt`, `updatedAt`, `lastAccessedAt`
- `Settings`: `geminiApiKey`, `tags`, `assistantIntents`
- `AssistantConfiguredIntent`: user-configurable quick assistant question mapping

SQLite tables initialized in `src/utils/db.ts`:

- `notebooks`
- `tasks`
- `subtasks`
- `task_tags`
- `settings`
- `task_status_events`
- `task_due_date_events`

Important scoping:

- `settings.notebook_id = 0` stores the global `geminiApiKey`.
- Notebook-scoped settings store `tags` and `assistantIntents`.
- Tasks, subtasks, task tags, status history, due-date history, and mindmap state are notebook-scoped.
- Mindmap client state uses localStorage key `task-manager-mindmap-state:<notebookId>`.

## Product Behavior

### Notebooks

- Opening the app without `?notebookId=` loads the most recently active notebook and updates the URL.
- Selecting another notebook opens `/?notebookId=<id>` in a new tab/window.
- Notebook names are stored case-preserved and displayed uppercase in the header.
- Header button displays `Notebook | <NAME>` on wider screens and `NB | <NAME>` on small screens.
- New notebooks are empty except for seeded settings. Legacy CSV tasks must not be copied into every new notebook.
- `migrateLegacyCsvIfNeeded()` only imports `data/tasks.csv` when the entire database has no tasks.

### Task List

- Default table hides `DONE` and `CANCELLED`; `Show All` reveals them.
- Sorting groups statuses by `STATUS_ORDER`, then `sortOrder`, tags, assignee, due date, and id.
- Drag reorder only works within the same status.
- Bulk actions include delete, add tag, set status, assignee, and hide.
- Search supports quoted phrases plus simple `and`, `or`, and `+` token logic.
- Due filters focus on active statuses unless specifically searching overdue.

### Progress

- Manual task progress options are `0`, `20`, `40`, `60`, `80`, `100`.
- Tasks with subtasks derive progress from completed subtasks and disable manual progress editing.
- Manual progress `100` sets status to `DONE`.
- Manual progress `20`, `40`, `60`, or `80` sets status to `IN PROGRESS`.
- Adding subtasks switches the task to subtask-derived progress.
- Task list shows the `%` column only when progress is greater than `0`.
- Mindmap badges show progress only when greater than `0`.

### Mindmap

- Mindmap is full-screen and notebook-scoped.
- Completed subtasks are gray and line-through.
- `Show all` applies to both completed/cancelled tasks and completed subtasks.
- Task badges show progress and subtask count in a small right-edge badge group.
- The edit pencil must remain reliably clickable.

### Assistant

- Gemini API key is configured in Settings and stored globally.
- `extract-task` parses free text into one or more tasks.
- `assistant-query` first checks exact enabled configured intents.
- If no configured intent matches, Gemini classifies into supported deterministic intents.
- If the intent is `UNKNOWN`, Gemini plans one SQLite `SELECT`; `assistantSqlPlanner` validates table names, blocks unsafe SQL, enforces task notebook filtering, appends active notebook id, opens the DB read-only, and limits rows.
- Assistant answers should be concise Vietnamese and should not invent missing tasks or metrics.

### Settings And Import/Export

- Settings exposes Gemini key and tag management as normal options.
- Assistant Intents are advanced and should stay hidden behind an advanced/configure section by default.
- Full database CSV import/export is handled through `/api/database-csv` and includes notebooks.

## Design Notes

- Current visual language is Neo Mint: restrained teal/action-green, white and soft surfaces, compact controls, 8-12px radii.
- Prefer MUI components and icons already used in the app.
- Keep data tools dense and scan-friendly. Do not introduce landing-page or marketing layout patterns.
- Avoid nested cards and oversized hero typography inside the operational app shell.

## Portable Sharing Notes

The portable ZIP is Windows-only. A recipient can:

1. Extract `AI-TASK-Portable.zip`.
2. Double-click `Run AI TASK.bat`.
3. Keep the command window open while using the app.
4. Back up or move the `data/` folder to preserve tasks.

## Verification Expectations

Before handing off code changes, usually run:

```powershell
npm run lint
npm run build
```

Only run:

```powershell
npm run package:portable
```

when the user explicitly asks for a portable build.

For documentation-only changes to this file, lint/build are optional unless other files were edited.

## Known Cautions

- The app uses local SQLite and local filesystem data, not a cloud database.
- `data/task-manager.db` is real user data. Do not overwrite it.
- `.next/`, `dist/`, log files, screenshots, SQLite WAL/SHM files, and `tsconfig.tsbuildinfo` are generated/local artifacts.
- Existing files contain some mojibake Vietnamese strings. Avoid broad encoding churn unless the task is specifically to fix text encoding.
- Do not run destructive git or filesystem commands.
