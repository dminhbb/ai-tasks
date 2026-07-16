# AI TASK — AI Agent Development Guide

> Last reviewed: 2026-07-16  
> Current database migration source: `20260716000100_recurrent_tasks.sql` (apply status must be verified per Supabase project)  
> This document is the primary technical handoff for AI coding agents working in this repository.

## Quick Start for AI Agent

1. Work from the repository root: `D:\AI\ai-tasks`.
2. Read `AGENTS.md` and `CODING_STANDARD_AI.md` before changing code.
3. This project uses Next.js `16.2.10`; read the relevant guide in `node_modules/next/dist/docs/` before changing Next.js APIs, routing, configuration, or conventions.
4. Inspect `git status --short` before editing. The working tree may contain uncommitted user changes; do not overwrite or revert them.
5. Do not push Git, deploy Vercel/Cloudflare, deploy Edge Functions, or mutate production Supabase unless the user explicitly requests that action.
6. Supabase PostgreSQL is the application datastore. The browser does not use SQLite during normal operation.
7. Authorization must be enforced by Supabase RLS, RPC, or Edge Functions. Hiding a button is only a UI convenience.
8. Space URLs use `/s/{slug}`. A signed-in user without a slug first selects an accessible Space.
9. Global roles are `superadmin`, `admin`, and `user`; actual Space and Notebook access also depends on membership records.
10. A subtask cycles through `TO DO → IN PROGRESS → DONE → TO DO`. Only `DONE` means `completed = true`.
11. Keep subtask `status`, `completed`, `completedAt`, completion events, and `workHours` consistent.
12. Do not edit an already-applied migration. Add a new timestamped migration and a matching rollback file.
13. Never expose `SUPABASE_SECRET_KEY`, the Supabase service-role key, or `GEMINI_API_KEY` to client code or `NEXT_PUBLIC_*` variables.
14. Reuse the shared data layer, types, domain utilities, and security helpers instead of duplicating their logic inside components.
15. Before handoff, normally run `npm.cmd run format:check`, `lint`, `typecheck`, `test`, `build`, and `audit` in proportion to the change.

## 1. Purpose and instruction priority

This guide explains the current architecture, business rules, permissions, source layout, database history, security requirements, and development workflow of AI TASK. It is intended to let a new AI agent work safely without reconstructing the system from conversation history.

Use this instruction priority:

1. The user's latest explicit request.
2. System, developer, workspace, and `AGENTS.md` instructions.
3. `CODING_STANDARD_AI.md`.
4. This guide.
5. `README.md` and `PROJECT_CONTEXT_FOR_CODEX.md` as supporting historical context.

`PROJECT_CONTEXT_FOR_CODEX.md` describes an earlier stage of the Supabase migration and is now incomplete. When it conflicts with the current source, migrations, or this reviewed guide, inspect the source and latest migrations before deciding.

## 2. Product overview

AI TASK is a multi-Space task manager with:

- Supabase email/password authentication.
- Global users and Space-scoped access.
- Multiple Notebooks in each Space.
- Tasks, tags, rich-text details, subtasks, ordering, filters, and history.
- Today Tasks popup, Today right panel, batch entry, suggestions, Undo deletion, and Mindmap mode.
- A separate Recurr Task schedule module for non-executing recurrent templates.
- Gemini-assisted task extraction and task-data search, plus non-AI notebook title search.
- User, Space, Notebook-access, tag, assistant, and theme settings according to role.
- Shared cloud data for localhost, Vercel, Cloudflare Pages, and the Windows portable build.

The application is intended for a small deployment. It is client-heavy and uses Supabase directly for authenticated data access.

## 3. Current technology and runtime

| Area | Current implementation |
| --- | --- |
| Framework | Next.js `16.2.10`, App Router |
| UI | React `19.2.4`, MUI `9.0.1`, Emotion |
| Language | TypeScript strict mode |
| Database/Auth | Supabase PostgreSQL, Auth, RLS, RPC |
| Server-side integrations | Supabase Edge Functions on Deno |
| AI provider | Gemini, called only from Edge Functions |
| Runtime validation | Zod |
| Rich text | `react-quill-new`, Quill override `2.0.2`, DOMPurify |
| Unit/integration tests | Vitest, Testing Library, jsdom |
| E2E tests | Playwright |
| CI | GitHub Actions quality workflow |
| Local theme persistence | Browser `localStorage` |

### 3.1 UI design system and redesign guardrails

The interface was visually redesigned on 2026-07-16 while preserving all product behavior. Future UI work must extend this system rather than reintroducing isolated colours, typography, or layout rules.

- **Design intent:** dense, calm, serious B2B productivity workspace; it is not a marketing landing page.
- **Visual density:** compact controls and data views are intentional. Improve hierarchy and scanability without hiding established actions.
- **Component library:** retain MUI 9 and its accessible primitives. Do not introduce another component system or Tailwind for one-off UI work.
- **Typography:** the root layout self-hosts the existing Inter variable font through `next/font` as `--font-app`. `--font-gilroy` is the project-wide semantic font alias and must remain the preferred component font token.
- **Semantic tokens:** `src/app/globals.css` is the source of truth. Use tokens such as `--surface-raised`, `--surface-soft`, `--surface-inset`, `--card-border-soft`, `--border-strong`, `--shadow-sm|md|lg`, `--focus-ring`, and `--transition-fast` instead of raw colors/shadows.
- **Themes:** Neo Mint, Midnight, and Cobalt Contrast must preserve readable text, controls, selected states, borders, and Mindmap connections. Never add light-only raw white/black UI styles without checking Midnight.
- **Shape and elevation:** compact controls use 8px radius; input/button defaults use 10px; standard surfaces use 16px; major dialogs/login use 20-24px. Use semantic shadows sparingly; do not stack cards inside cards without a clear hierarchy.
- **Interaction:** use `--transition-fast` for short state changes. Do not add autoplay, parallax, or decorative motion. `prefers-reduced-motion` is globally respected.
- **Accessibility:** icon-only controls require an `aria-label`; keep keyboard focus visible through the global focus ring; do not rely on color alone for important state.
- **Responsive behavior:** retain the task workspace and its functions at narrow widths. Toolbar actions may horizontally scroll rather than silently disappear; dialogs and panels must remain usable on mobile.

The redesign deliberately does **not** use landing-page patterns such as hero sections, bento marketing grids, full-page gradients, stock imagery, or GSAP-heavy motion.

Node.js 20 or newer is required locally. CI currently uses Node.js 22.

## 4. Architecture

```text
Browser / Next.js client
  ├─ Supabase Auth ─────────────── email/password session
  ├─ Supabase Data API + RLS ───── reads and authorized table writes
  ├─ Supabase RPC ──────────────── atomic or privileged domain operations
  └─ Supabase Edge Functions
       ├─ extract-task ─────────── Gemini task extraction
       ├─ assistant-query ──────── authorized task-data assistant
       └─ admin-users ──────────── Supabase Auth user administration

Supabase PostgreSQL
  ├─ public schema ─────────────── application tables and callable RPCs
  └─ private schema ────────────── authorization and trigger helpers
```

Important boundaries:

- `src/lib/supabase/client.ts` creates and validates the browser client.
- `src/lib/supabase/data.ts` owns typed database reads and RPC calls.
- `src/lib/supabase/functions.ts` owns typed Edge Function calls and response validation.
- Components should not introduce ad hoc authorization or duplicate complex database operations.
- `private` schema helpers are not browser APIs. Public RPCs call them under controlled `security definer` functions.

## 5. Authentication, routing, and access bootstrap

### 5.1 Login

- Login uses email as the username and Supabase `signInWithPassword`.
- There is no public self-registration UI.
- `AuthProvider` loads `profiles` after authentication and signs out inactive or invalid accounts.
- `profiles.is_active` and the corresponding Supabase Auth ban state are used for deactivation.

### 5.2 Space selection

- The canonical Space route is `/s/{slug}`.
- At `/`, an authenticated user is shown a grid of accessible Spaces.
- `superadmin` receives every Space from `list_accessible_spaces()`.
- `admin` and `user` receive only Spaces with an applicable membership.
- Once selected, all data loading follows the Space slug.

### 5.3 Access error screens

After login:

- No accessible Space: `Lỗi: Chưa được phân quyền vào Space`.
- Accessible Space but no accessible Notebook: `Lỗi: Chưa được phân quyền vào Notebook của Space`.

These screens intentionally show only the top bar and a centered warning area.

### 5.4 Server and static routing

- Next.js server builds rewrite `/s/:slug` to `/`; client code reads the pathname.
- Cloudflare Pages uses static export, so the hosting configuration must provide SPA fallback/rewrites for `/s/*` to the exported root page.
- Vercel and the portable Next.js server use the server rewrite in `next.config.ts`.

## 6. Authorization model

Authorization is the combination of global role, Space membership, Notebook membership, and RLS/RPC checks.

### 6.1 Global roles

| Role | Effective behavior |
| --- | --- |
| `superadmin` | Full access to every Space and Notebook; manages global users and Space lifecycle. |
| `admin` | Can administer Spaces where `space_members.role = 'admin'`; sees all Notebooks in those Spaces. |
| `user` | Uses tasks/subtasks in explicitly assigned Notebooks inside assigned Spaces. |

The global `admin` role alone does not grant access to every Space. It must be paired with an admin Space membership.

### 6.2 Space access

- `private.can_access_space()` grants all Spaces to an active superadmin.
- Other users require a `space_members` row.
- `private.is_space_admin()` treats superadmin as admin everywhere and otherwise checks active admin membership.
- A new Space must retain at least one assigned admin.
- Creating a Space creates `Default Notebook` automatically.

### 6.3 Notebook access

- Superadmin and Space admin see all Notebooks in the Space.
- Regular users require `notebook_members` assignment.
- Assigning a regular user to a Space automatically assigns the first Notebook if the user has no Notebook assignment in that Space.
- Creating the first Notebook also assigns Space users that still have no Notebook.
- Regular user permissions default to:

```json
{
  "manage_tasks": true,
  "manage_notebook": false,
  "manage_settings": false
}
```

### 6.4 User management scope

- Superadmin can list, create, update, deactivate, and permanently delete eligible users.
- A Space admin can create and manage regular users in that Space.
- A Space admin sees regular users plus admins assigned to that Space; peer admins are read-only.
- Space admins never receive superadmin management authority.
- Deactivate is the normal delete action. Permanent deletion is separate and superadmin-only.
- The last active superadmin cannot be demoted, deactivated, or deleted.
- A user who still owns Notebooks cannot be permanently deleted.
- Auth administration actions are logged in `user_admin_audit_events`.

## 7. Core data model

### 7.1 Main entities

| Entity | Purpose |
| --- | --- |
| `profiles` | Application identity, email, nickname, global role, active state. |
| `spaces` | Top-level tenant boundary identified by unique slug. |
| `space_members` | User membership and `admin`/`user` Space role. |
| `space_settings` | Space-wide tags and Assistant Advanced configuration. |
| `notebooks` | Task container inside one Space. |
| `notebook_members` | Explicit regular-user Notebook access and permission JSON. |
| `tasks` | Main work items with status, dates, assignee, rich text, progress, and ordering. |
| `subtasks` | Ordered child work items with Today flag, status, completion metadata, and work hours. |
| `task_tags` | Task-to-tag records. |
| `task_status_events` | Task status history. |
| `task_due_date_events` | Due-date change history. |
| `subtask_completion_events` | Subtask completion/reopen history and logged work hours. |
| `recurrent_tasks` | Separate parent templates used only by the Recurr Task schedule. |
| `recurrent_subtasks` | Ordered recurring schedule items, recurrence rule, anchor date, and weekdays. |
| `ai_request_log` | Per-user AI quota accounting. |
| `user_admin_audit_events` | User administration audit history. |

### 7.2 Space consistency

`space_id` is stored on Notebooks and their major child records. Database triggers derive child `space_id` from the parent Notebook or Task. Moving a Notebook between Spaces is intentionally unsupported.

Deleting a Space cascades its memberships, settings, Notebooks, tasks, subtasks, tags, and related history. Treat Space deletion as destructive even though the UI requires confirmation.

### 7.3 Task statuses

Task status values:

```text
URGENT | IN PROGRESS | TO DO | PENDING | CANCELLED | DONE
```

Task progress is derived from completed subtasks unless a supported manual-progress rule applies. Use `src/utils/taskProgress.ts` and `src/utils/taskTimestamps.ts` rather than reimplementing this logic.

### 7.4 Subtask status invariant

Subtask status values:

```text
TO DO → IN PROGRESS → DONE → TO DO
```

Required invariants:

- `DONE` means `completed = true`.
- `TO DO` and `IN PROGRESS` mean `completed = false`.
- Entering `DONE` records `completedAt` and a completion event.
- Leaving `DONE` clears `completedAt` and resets `workHours` to `0` in the client domain utility.
- `SubtaskStatusControl` is used in Task Details, Today Tasks, and the Today right panel.
- Legacy completion actions, including Mindmap Done, must update status consistently.
- The database trigger `private.sync_subtask_status_and_completion()` is the final consistency guard.

Supported `workHours` values are:

```text
0, 0.5, 1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24
```

The database columns use `numeric(4,1)`. Update both `subtasks.work_hours` and the latest completion event through the existing save/trigger flow.

## 8. Product behavior and UI invariants

### 8.1 Spaces and Notebooks

- The dialog first selects a Space, then loads only accessible Notebooks in that Space.
- Clicking the notebook name area opens it in the current tab.
- The first Launch icon opens it in a new browser tab.
- Space admins can create, rename, and delete Notebooks.
- Notebook deletion has two confirmations; the second requires the exact Notebook name.
- Newly created Spaces receive `Default Notebook`.

### 8.2 Task list and Task Details

- `(Untitle Tasks)` is the special task used by Today batch entry.
- It is pinned above all other tasks, including Urgent tasks, and displayed with a pin marker and bold title.
- Task and subtask ordering use persisted `sortOrder`; lower values appear first and have higher priority.
- Subtasks can be reordered in Task Details and Today Tasks.
- Rich-text task content must pass through `sanitizeRichText()` before rendering or saving.
- Moving a subtask uses `move_subtask` RPC and must keep source/target Notebook authorization intact.

### 8.3 Today Tasks

- `isToday = true` includes a subtask in Today Tasks.
- Completed Today subtasks remain visible for at most three days.
- The right panel is closed by default and includes the signed-in user's `nickname | role`, then email, then Today subtasks.
- Opening Task Details from Today and closing/saving it should return the user to Today Tasks.
- `Load more` suggests one highest-priority incomplete, non-Today subtask from each overdue task or task due within seven days.
- Suggested rows have a muted/gray background and do not switch `isToday` on automatically.
- Batch add accepts one subtask per non-empty line, up to 100 lines, and adds them as Today items to `(Untitle Tasks)`.
- Today Tasks supports completion/status changes, work log, Today toggle, move, delete, and reordering.
- Completed subtasks are sorted after active subtasks in both the Today popup and right panel.
- Deleting a subtask from the Today popup hides it immediately and shows an Undo toast for five seconds; only expiry persists deletion.
- The Today popup uses a responsive grid/table with a fixed action footer. Keep the grid usable without horizontal scrolling except at very narrow widths.

### 8.4 Recurr Task

- Recurrent Tasks are separate from normal `tasks` and never appear in the main task list or create execution tasks automatically.
- The full-screen `Recurr Task` screen has a Mindmap-style opaque dotted background and a responsive three-week grid. Weeks begin on Monday.
- The first visible week is based on the current schedule reference; Prev/Next moves one week, and Today resets the reference date.
- Parent recurrent tasks are expandable. Only recurrent subtasks have schedules.
- Supported recurrence values are `weekly`, `bi-weekly`, `monthly`, `quarterly`, `half-yearly`, and `yearly`.
- Weekly and bi-weekly subtasks support one or more weekdays, numbered Monday `1` through Sunday `7`; all types use an anchor date.
- Highlight the full Today column and the week containing Today whenever it is visible.
- CRUD is scoped to the active Notebook. Deleting a recurrent task requires two UI confirmations and cascades its recurrent subtasks; deleting a recurrent subtask requires one confirmation.

### 8.5 Notebook title search

- `TaskList` has a non-AI toolbar search for Task and Subtask titles in the current Notebook.
- Search results appear below the toolbar using the same result-surface pattern as AI Search; clicking a result opens the parent Task Details dialog.
- The clear (X) control resets the keyword and hides the results panel.

### 8.6 Mindmap

- Normal mode renders task hierarchy.
- Today mode shows a `##TODAY` root connected directly to Today subtasks, omitting parent Task nodes.
- Done actions must set both subtask `status = 'DONE'` and completion metadata consistently.

### 8.5 Settings

Settings uses a fixed footer and a scrollable left menu/content layout. Current sections are:

- Appearance
- Tag management
- Assistant Advanced
- Notebook access
- User management
- Space manager

Only Space admins/superadmins see management sections. Themes are stored only in browser `localStorage` under `ai-task-theme`:

- Neo Mint
- Pastel Rose
- Elegant Grey (light graphite theme with red accents)
- Midnight
- Cobalt Contrast

Space Manager behavior:

- Superadmin creates and edits Space name, slug, admins, and users.
- Space admin can manage regular-user membership for the active authorized Space.
- The Space-admin picker lists active global `admin` accounts, not regular users.
- Share link opens `Space shared link`; clipboard changes only after explicit Copy.
- Space deletion uses two confirmations; the second requires the exact Space name. The RPC also validates the Space slug.

### 8.6 AI features

- `Create via AI` invokes `extract-task`.
- `AI Search` opens a popup and invokes `assistant-query` for authorized Notebook data.
- Gemini secrets never enter the browser bundle.
- AI responses are runtime-validated before the UI uses them.
- AI-generated content is not executed as SQL.

## 9. Important source files

### 9.1 Application shell and authentication

- `src/app/page.tsx`: main client application, Space/Notebook bootstrap, dialogs, panels, and save orchestration.
- `src/app/layout.tsx`: root providers and document shell.
- `src/components/AuthProvider.tsx`: session and profile lifecycle.
- `src/components/LoginScreen.tsx`: login form.
- `src/components/SpaceSelectionScreen.tsx`: post-login Space grid.
- `src/components/AccessErrorScreen.tsx`: missing-access states.
- `src/utils/spaceRouting.ts`: parses and creates Space URLs.

### 9.2 Task UI

- `src/components/TaskList.tsx`: main task list, ordering, inline actions.
- `src/components/TaskDetailDialog.tsx`: task fields, rich text, subtask ordering/status/work log/move.
- `src/components/SubtaskStatusControl.tsx`: three-state subtask control.
- `src/components/SubtaskWorkLogSelect.tsx`: supported work-hour dropdown.
- `src/components/TodayWorkspace.tsx`: Today right panel and Today Tasks popup.
- `src/components/TodayBatchAddDialog.tsx`: free-text batch entry.
- `src/components/TodayMoveSubtaskDialog.tsx`: filtered parent-task selection.
- `src/components/TaskMindmapDialog.tsx`: standard and Today Mindmap modes.
- `src/components/RecurringTasksDialog.tsx`: full-screen recurrent schedule and recurrent task/subtask editing.
- `src/components/TaskAssistantPanel.tsx`: AI Search UI.
- `src/components/AddTaskDialog.tsx`: AI/manual task creation flow.

### 9.3 Settings and navigation

- `src/components/NotebookDialog.tsx`: Space/Notebook navigation and Notebook management.
- `src/components/SettingsDialog.tsx`: theme, tags, assistant, access, users, and Spaces.
- `src/components/ThemeProvider.tsx`: MUI themes and local persistence.
- `src/components/FilterPanel.tsx`: task filtering.

### 9.4 Domain utilities

- `src/types/index.ts`: shared domain types; do not redefine them in components.
- `src/utils/taskOrdering.ts`: pinned task, task priority, subtask priority.
- `src/utils/taskProgress.ts`: progress derivation and manual progress rules.
- `src/utils/taskTimestamps.ts`: task status timestamps.
- `src/utils/todayTasks.ts`: Today visibility, suggestions, and reordering.
- `src/utils/todayBatch.ts`: batch parsing and special-task creation.
- `src/utils/subtaskWork.ts`: status/completion/work-hour invariant.
- `src/utils/subtaskMove.ts`: move-dialog filtering.
- `src/utils/richText.ts`: DOMPurify-based rich-text sanitization.
- `src/utils/recurrentSchedule.ts`: Monday-based three-week calendar and recurrence matching rules.

### 9.5 Supabase integration

- `src/lib/supabase/client.ts`: browser client and public environment validation.
- `src/lib/supabase/data.ts`: Space, Notebook, normal task, recurrent task, settings, and membership data access.
- `src/lib/supabase/functions.ts`: Edge Function calls and Zod response validation.
- `supabase/functions/_shared/http.ts`: CORS, authentication, request limits, quota, and safe responses.
- `supabase/functions/_shared/gemini.ts`: Gemini request implementation and timeout.
- `supabase/functions/admin-users/index.ts`: scoped Auth user management.
- `supabase/functions/extract-task/index.ts`: task extraction.
- `supabase/functions/assistant-query/index.ts`: authorized task-data assistant.
- `supabase/functions/diagnose-gemini/`: diagnostic source; do not deploy to production unless explicitly required.

## 10. Important RPCs and database helpers

| Function | Purpose |
| --- | --- |
| `list_accessible_spaces()` | Returns only accessible Spaces plus effective admin flag. |
| `create_notebook_in_space(uuid, text)` | Creates an authorized Notebook and settings. |
| `save_space(...)` | Superadmin Space create/update, memberships, and default Notebook. |
| `delete_space(uuid, text)` | Permanent Space deletion with server-side confirmation. |
| `set_space_users(uuid, uuid[])` | Space-admin management of regular Space users. |
| `set_notebook_users(uuid, uuid[])` | Assigns regular users to a Notebook. |
| `save_task_bundle_with_work_hours(...)` | Atomic task, subtasks, tags, status, and work-hour save path. |
| `move_subtask(uuid, uuid, uuid)` | Authorized subtask move to another Task in the Notebook. |
| `save_recurrent_task_bundle(uuid, jsonb, jsonb)` | Atomic authorized recurrent task/subtask template save. |
| `consume_ai_quota()` | Enforces per-user AI request quota. |

Security-definer functions must:

- Validate input.
- Perform an explicit authorization check.
- Use `set search_path = ''`.
- Schema-qualify database objects.
- Revoke default public/anon access and grant only the intended role.

## 11. Migration ledger

Never modify these after they have been applied. Add a later migration instead.

| Migration | Main purpose |
| --- | --- |
| `20260714000100_initial_schema.sql` | Profiles, Notebooks, tasks, RLS, base triggers, history. |
| `20260714000200_task_bundle_rpc.sql` | Atomic task bundle save RPC. |
| `20260714000300_ai_rate_limit.sql` | AI request quota table and RPC. |
| `20260714000400_fix_task_bundle_permissions.sql` | Task bundle permission corrections. |
| `20260714000500_subtask_today.sql` | Today metadata and completion events. |
| `20260715000100_subtask_work_log_and_move.sql` | Work hours and subtask move RPC. |
| `20260715000200_spaces_and_access.sql` | Multi-Space schema, propagation, RLS, settings, audit. |
| `20260715000300_space_permissions_and_default_notebook.sql` | Effective Space listing, Notebook creation, default Notebook. |
| `20260715000400_fix_notebook_insert_policy.sql` | Notebook insert authorization fix. |
| `20260715000500_fix_notebook_returning_policy.sql` | Notebook returning/select policy fix. |
| `20260715000600_auto_assign_first_notebook.sql` | Automatic first-Notebook assignment. |
| `20260715000700_space_admin_user_management.sql` | Space-admin regular-user membership RPC. |
| `20260715000800_subtask_status.sql` | Three-state subtask status and completion sync. |
| `20260715000900_fractional_work_hours.sql` | Decimal work hours and expanded allowed values. |
| `20260716000100_recurrent_tasks.sql` | Separate recurrent task tables, RLS, triggers, and atomic save RPC. |

Every migration currently has a matching manual rollback in `supabase/rollbacks/`.

Last verified linked-project state on 2026-07-15: local and remote migrations matched through `20260715000900`. `20260716000100_recurrent_tasks.sql` is a newer local migration and must be applied separately. Always run `npx.cmd supabase migration list` again before assuming another environment has the same state.

## 12. Database change workflow

1. Inspect the latest migrations and current function definition being replaced.
2. Create `supabase/migrations/YYYYMMDDHHMMSS_description.sql`.
3. Create matching `supabase/rollbacks/YYYYMMDDHHMMSS_description.down.sql`.
4. Wrap multi-step changes in `begin; ... commit;`.
5. Drop dependent triggers or constraints before altering a referenced column type, then recreate them in the same transaction.
6. Preserve grants when replacing public RPCs.
7. Verify RLS behavior for superadmin, Space admin, and regular user.
8. Test on staging when available.
9. Review `npx.cmd supabase migration list`.
10. Only after explicit authorization, run `npx.cmd supabase db push`.
11. Re-run the migration list and application verification.

Do not run a rollback against production merely to test it. Validate destructive rollback behavior on a disposable/staging project.

## 13. Edge Functions

### 13.1 Common protections

Shared HTTP helpers provide:

- Exact-origin CORS based on `ALLOWED_ORIGINS`.
- Authenticated Supabase user validation.
- JSON content checks.
- Request-size limits.
- Generic production errors.
- AI quota enforcement where applicable.

Current request limits include:

- `extract-task`: 16 KiB request, 12,000-character text.
- `assistant-query`: 2 KiB request, 500-character question, at most 250 tasks in its prompt context.
- `admin-users`: 16 KiB request.

### 13.2 Deployment status and discipline

The application source expects these deployed functions:

- `extract-task`
- `assistant-query`
- `admin-users`

They were last reported deployed during the 2026-07-15 development session. Verify the target Supabase project before relying on that status. Deploy functions only when explicitly requested.

Typical commands:

```powershell
npx.cmd supabase functions deploy extract-task
npx.cmd supabase functions deploy assistant-query
npx.cmd supabase functions deploy admin-users
```

`admin-users` uses the hosted Supabase service-role environment internally. Never copy that key into frontend configuration.

## 14. Environment variables and secrets

### 14.1 Browser-safe build variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

These are embedded at build time. Configure them separately in local `.env.local`, Vercel, and Cloudflare build settings.

### 14.2 Trusted local scripts only

```text
SUPABASE_SECRET_KEY
SEED_SUPERADMIN_EMAIL
SEED_SUPERADMIN_PASSWORD
MIGRATION_OWNER_EMAIL
```

Do not commit `.env.local`. Do not add a `NEXT_PUBLIC_` prefix to a trusted secret.

### 14.3 Supabase Edge Function secrets

```text
GEMINI_API_KEY
GEMINI_MODEL
ALLOWED_ORIGINS
```

Configure these with `supabase secrets set`. `ALLOWED_ORIGINS` should contain exact frontend origins, comma-separated, with no permissive wildcard in production.

## 15. Security requirements

- RLS/RPC/Edge authorization is mandatory for every sensitive operation.
- Never trust Space ID, Notebook ID, Task ID, user ID, slug, role, or permission values supplied by the client.
- Validate API/database responses with Zod where the current data layer does so.
- Sanitize user-authored rich text before render/save.
- Do not use `dangerouslySetInnerHTML` with unsanitized content.
- Keep request limits and generic production errors in Edge Functions.
- Do not log passwords, JWTs, API keys, private task content, or service credentials.
- Preserve CSP and other headers in `next.config.ts`.
- Next.js headers are not emitted by static export; configure equivalent security headers at Cloudflare Pages.
- User-management writes must stay inside `admin-users`; never use an admin/service key from browser code.
- Permanent deletion requires explicit confirmation and must remain distinct from deactivation.
- Run `npm.cmd run audit` after dependency changes and before deployment.

The pre-migration v1 backup is outside the repository at:

```text
D:\AI\ai-tasks-backups\AI-TASK-v1-20260714-105525.zip
```

Treat the archive as sensitive because it contains a legacy SQLite snapshot and settings. Never restore legacy secrets into source control.

## 16. Local development and verification

### 16.1 Install and run

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`. Localhost uses the same configured Supabase cloud project as deployed frontends.

### 16.2 Quality commands

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run test:coverage
npm.cmd run build
npm.cmd run audit
npm.cmd run test:e2e
```

Current verified baseline after migration `20260715000900`:

- 17 Vitest files.
- 36 tests passing.
- Type-check passing.
- ESLint passing.
- Production build passing.
- High-level dependency audit reports no vulnerabilities.

Redesign verification on 2026-07-16 (local only; no Git or hosting deployment):

- Prettier check passing.
- Type-check and ESLint passing.
- 17 Vitest files / 36 tests passing.
- Production build passing.
- 2 Playwright smoke tests passing.
- `npm audit --audit-level=high` reports zero vulnerabilities.

Warnings about Node's deprecated `module.register()` or jsdom `localStorage` configuration are dependency/runtime warnings, not current application test failures. Do not suppress a new warning without identifying its source.

### 16.3 CI

`.github/workflows/quality.yml` runs on push and pull request:

1. `npm ci`
2. Format check
3. ESLint
4. Type-check
5. Coverage tests
6. Dependency audit
7. Production build
8. Chromium installation
9. Playwright E2E tests

## 17. Build and deployment

### 17.1 Vercel or Next.js server

```powershell
npm.cmd run build
```

`next.config.ts` uses standalone output. Vercel must have both public Supabase variables configured for Preview and Production. Redeploy after changing them.

### 17.2 Cloudflare Pages

```powershell
npm.cmd run build:cloudflare
```

Use `out` as the output directory. Configure public Supabase variables before the build, add `/s/*` SPA fallback, and configure security headers at the provider because Next.js server headers/rewrites are disabled for static export.

### 17.3 Windows portable package

```powershell
npm.cmd run package:portable
```

The portable application still requires internet access to Supabase. It is not an offline SQLite version.

### 17.4 Deployment authority

Building locally does not authorize deployment. Do not:

- Commit or push Git.
- Open or merge a pull request.
- Deploy Vercel/Cloudflare.
- Push migrations.
- Deploy Edge Functions.
- Change Supabase secrets.

unless the user explicitly requests the corresponding action.

## 18. Coding rules for future changes

- Use TypeScript strict types; do not use `any` to bypass errors.
- Reuse shared types from `src/types/index.ts`.
- Validate unknown external data before use.
- Keep components focused; move reusable business logic into domain utilities.
- Use `apply_patch` for deliberate source edits in agent workflows.
- Preserve unrelated user changes in a dirty worktree.
- Avoid adding dependencies when the existing stack can implement the feature.
- Use MUI and existing CSS variables/theme tokens for consistent UI.
- Provide accessible names for icon-only buttons and state controls.
- Add or update unit/integration/E2E tests according to risk.
- Update this guide when architecture, permissions, domain invariants, deployment steps, or migrations materially change.

For a new subtask mutation, verify all of the following:

```text
UI state
→ shared Subtask type
→ domain invariant utility
→ saveTasks payload
→ save_task_bundle_with_work_hours RPC
→ database trigger/constraint
→ completion event/work log
→ tests
```

For a new authorization-sensitive feature, verify:

```text
UI visibility
→ client data call
→ authenticated identity
→ RLS/RPC/Edge authorization
→ cross-Space and cross-Notebook IDOR checks
→ role-specific tests
```

## 19. Known constraints and planned direction

- Work reporting is planned but no complete reporting module exists yet.
- Work hours and completion events are already stored to support future reports.
- There is no public signup, password-reset, or self-service profile screen.
- There is no realtime collaborative synchronization; concurrent edits may use last successful save behavior.
- The application does not support moving a Notebook between Spaces.
- Theme choice is browser-local and is not synchronized through Supabase.
- Cloudflare static hosting requires provider-level routing and security-header configuration.
- Legacy SQLite exists only for migration/recovery; do not add new runtime features against it.
- `diagnose-gemini` should remain a controlled diagnostic tool, not a default public production endpoint.

Before implementing a large new module such as reporting, permissions expansion, or cross-Space operations, discuss the data model, RLS impact, migration/rollback strategy, and UI flow with the user first.

## 20. AI agent handoff template

Use this template at the end of substantial work:

```markdown
## Outcome

- What changed and the user-visible result.

## Files

- Important source files created or modified.

## Database

- Migration created:
- Rollback created:
- Migration applied locally/staging/remote: yes/no/unknown

## Edge Functions

- Functions changed:
- Functions deployed: yes/no/unknown

## Verification

- Format:
- Lint:
- Type-check:
- Unit/integration tests:
- E2E:
- Build:
- Audit:

## Deployment

- Git pushed: yes/no
- Vercel/Cloudflare deployed: yes/no

## Remaining work or risk

- Known limitations, manual steps, or user decisions still required.
```

The final handoff must distinguish clearly between code prepared locally, database migrations applied remotely, Edge Functions deployed, and frontend deployment completed. Never imply deployment occurred merely because a build passed.
