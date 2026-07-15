# AI TASK

AI TASK is a Next.js 16 task manager backed by Supabase Auth, PostgreSQL Row Level Security, and Supabase Edge Functions for Gemini features.

## Prerequisites

- Node.js 20 or newer
- A Supabase project
- Supabase CLI (`npx supabase` is supported)
- A restricted Gemini auth key

## Configure the project

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase Connect dialog.
3. Set `SUPABASE_SECRET_KEY` only on the trusted machine used for migration and seeding. Never expose it with a `NEXT_PUBLIC_` prefix.
4. Set `SEED_SUPERADMIN_PASSWORD` in `.env.local`. Do not commit this file.

## Deploy the database and seed the first account

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
npx.cmd supabase db push
npm.cmd run supabase:seed-admin
npm.cmd run supabase:migrate-data
```

The seed script creates or updates `minhd.mbb@gmail.com`, confirms its email, and assigns the `superadmin` role. The password is read only from `SEED_SUPERADMIN_PASSWORD`; it is intentionally absent from source control. For a fresh account without migrated data, the application creates `MAIN` after the first sign-in.

Run `supabase:migrate-data` once. It reads `data/task-manager.db`, migrates all notebooks/tasks/subtasks/tags/history to UUID records, and deliberately excludes the legacy Gemini key.

## Deploy Edge Functions

Configure exact frontend origins in `ALLOWED_ORIGINS`, separated by commas:

```powershell
npx.cmd supabase secrets set GEMINI_API_KEY=YOUR_NEW_AUTH_KEY
npx.cmd supabase secrets set GEMINI_MODEL=gemini-3.5-flash
npx.cmd supabase secrets set ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.example
npx.cmd supabase functions deploy extract-task
npx.cmd supabase functions deploy assistant-query
npx.cmd supabase functions deploy admin-users
```

The Gemini key exists only in Supabase Function secrets. Both functions require an authenticated Supabase JWT, apply a per-user quota, validate input, and never execute model-generated SQL.
`admin-users` is restricted to active `superadmin` accounts and uses Supabase's server-only service-role secret, which is available automatically inside hosted Edge Functions. Never add that secret to the frontend or to a `NEXT_PUBLIC_*` variable.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000` and sign in with a seeded Supabase account. Localhost uses the same cloud database as deployed frontends.

## Authorization model

- `superadmin`: manages Auth users and all spaces, including permanent space deletion.
- Space `admin`: sees every notebook in an assigned space and can manage that space's notebooks, tags, assistant configuration, and notebook access.
- Space `user`: belongs to a space but sees only notebooks explicitly assigned by a Space admin. The user can modify tasks and subtasks, but cannot manage notebooks or configuration.

Settings separates Appearance, Tag management, Assistant Advanced, and Notebook access. Superadmins additionally see User management and Space manager. Deleting a user from the normal user action means deactivation; permanent deletion is deliberately separate. Every space must retain at least one assigned admin.

Database RLS is the source of truth. Hiding a button in the frontend is only a usability measure.

Spaces are opened at `/s/{slug}`. Users who belong to multiple spaces can switch from the compact Space selector in the top toolbar. Space share links use the same slug route. Deleting a space cascades its notebooks, tasks, subtasks, tags, and logs at the database layer, so test deletion on staging and keep a database backup.

## Build and deploy

Vercel or the portable Node server:

```powershell
npm.cmd run build
```

For Vercel, add `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` under Project Settings > Environment
Variables for both Production and Preview. Redeploy after changing either
value because Next.js embeds `NEXT_PUBLIC_*` variables during the build.

Cloudflare Pages static export:

```powershell
npm.cmd run build:cloudflare
```

Use `out` as the Cloudflare Pages output directory. Configure the two public Supabase variables in the hosting dashboard before building.

Windows portable package:

```powershell
npm.cmd run package:portable
```

The portable package now requires internet access and stores data in Supabase rather than a local `data` folder.

## Verification

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

The migration and Edge Function deployment commands above intentionally change remote Supabase state. Run them only after reviewing `supabase/migrations/20260715000200_spaces_and_access.sql` and its rollback file in a staging project first.
