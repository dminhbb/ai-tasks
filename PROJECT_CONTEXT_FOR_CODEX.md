# AI TASK Project Context

## Current architecture

- Next.js `16.2.6`, React `19.2.4`, TypeScript strict mode, MUI `9`.
- Browser-side Supabase Auth and Data API so the same app works on localhost, Vercel, Cloudflare Pages, and the Windows portable server.
- Supabase PostgreSQL is the only application datastore.
- Supabase Edge Functions own Gemini calls and secrets.
- Legacy SQLite is retained only under ignored `data/` for one-time migration and v1 recovery.

Read `AGENTS.md` and the relevant documentation in `node_modules/next/dist/docs/` before changing Next.js code.

## Backup

The pre-migration v1 snapshot is outside the repository:

`D:\AI\ai-tasks-backups\AI-TASK-v1-20260714-105525.zip`

SHA-256: `E23D7D4681B3687E9109119FCC8CD405626E9BAE5FF96275DF4E76ED8F85842B`

The archive includes a consistent SQLite snapshot and legacy settings. Treat it as sensitive.

## Important files

- `src/components/AuthProvider.tsx`: Supabase session and profile loading.
- `src/components/LoginScreen.tsx`: email/password login UI.
- `src/lib/supabase/client.ts`: browser Supabase client and public env validation.
- `src/lib/supabase/data.ts`: notebook/task/settings data access.
- `src/lib/supabase/functions.ts`: typed Edge Function calls.
- `supabase/migrations/`: schema, RLS, task bundle RPC, and AI quota.
- `supabase/rollbacks/`: matching manual rollback scripts.
- `supabase/functions/`: authenticated Gemini functions.
- `scripts/seed-supabase-admin.mjs`: safe admin seed using the Supabase Admin API.
- `scripts/migrate-sqlite-to-supabase.mjs`: one-time legacy data migration.

## Authorization

- Global roles: `superadmin`, `admin`, `user` in `profiles.role`.
- Notebook assignment: `notebook_members`.
- Admin detail permissions: JSON flags `manage_tasks`, `manage_notebook`, `manage_settings`.
- RLS helper functions in the non-exposed `private` schema enforce permissions.
- No user-management UI exists yet; manage users and notebook memberships from Supabase.

## Secrets

- Public browser values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Trusted migration only: `SUPABASE_SECRET_KEY`.
- Edge Function only: `GEMINI_API_KEY`, `GEMINI_MODEL`, `ALLOWED_ORIGINS`.
- Never restore the legacy Gemini key from SQLite or the v1 ZIP into source control.

## Commands

```powershell
npm.cmd run dev
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
npm.cmd run build:cloudflare
npm.cmd run supabase:seed-admin
npm.cmd run supabase:migrate-data
npm.cmd run package:portable
```

## Deployment status

The code and migrations are prepared locally. A real Supabase project URL and secret key are required before `db push`, user seeding, legacy data migration, or Edge Function deployment can happen.
