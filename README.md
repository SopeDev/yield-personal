# Yield Personal

Personal finances as a mobile-first PWA. Part of the Yield brand — see `BRAND.md`.

## Setup

1. Copy `.env.example` to `.env.local` and fill it in:
   - `DATABASE_URL`: a Postgres database (for example Prisma Postgres or Neon from the Vercel Marketplace).
   - `AUTH_SECRET`: generate with `npx auth secret`.
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`: a Google OAuth client with redirect URI
     `http://localhost:3000/api/auth/callback/google` (plus your production URL).
   - `DATA_ENCRYPTION_KEY`: encrypts amounts, names and notes in the database; generate with
     `openssl rand -base64 32` and keep a copy somewhere safe (without it the data can't be read).
2. Install and migrate:

```bash
npm install
npm run db:deploy    # applies prisma/migrations (safe for a shared/production database)
npm run db:encrypt   # encrypts anything still stored in plaintext (safe to repeat)
npm run dev          # http://localhost:3000
npm run check        # lint, typecheck, tests, build
```

Use `npm run db:migrate` only against a disposable development database: when creating new
migrations it may offer to reset the database.

On Vercel, set the same environment variables. Each deployment applies pending migrations and encrypts anything
still in plaintext before building (`vercel.json`); without `DATA_ENCRYPTION_KEY`, or with a different key than the
one the database was encrypted with, the deployment fails and the current one keeps serving. Every environment that
shares a database (Production, and Preview if it uses the same one) needs the same key.

Project context lives in `AGENTS.md`, `PROJECT_DECISIONS.md`, and `PROJECT_PROGRESS.md`.
