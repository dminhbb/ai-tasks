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

## Deploy Gemini Edge Functions

Configure exact frontend origins in `ALLOWED_ORIGINS`, separated by commas:

```powershell
npx.cmd supabase secrets set GEMINI_API_KEY=YOUR_NEW_AUTH_KEY
npx.cmd supabase secrets set GEMINI_MODEL=gemini-3.5-flash
npx.cmd supabase secrets set ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.example
npx.cmd supabase functions deploy extract-task
npx.cmd supabase functions deploy assistant-query
```

The Gemini key exists only in Supabase Function secrets. Both functions require an authenticated Supabase JWT, apply a per-user quota, validate input, and never execute model-generated SQL.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000` and sign in with a seeded Supabase account. Localhost uses the same cloud database as deployed frontends.

## Authorization model

- `superadmin`: full application and notebook access.
- `admin`: access is granted per notebook through `notebook_members`; detailed `manage_notebook` and `manage_settings` flags default to false until configured.
- `user`: can view and modify tasks and subtasks in assigned notebooks, but cannot manage notebooks, settings, or users.

Database RLS is the source of truth. Hiding a button in the frontend is only a usability measure.

## Build and deploy

Vercel or the portable Node server:

```powershell
npm.cmd run build
```
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
npx.cmd tsc --noEmit
npm.cmd run build
```
