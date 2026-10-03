# Yield Personal

Personal finances as a mobile-first PWA. Part of the Yield brand — see `BRAND.md`.

## Setup

1. Copy `.env.example` to `.env.local` and fill it in:
   - `DATABASE_URL`: a Postgres database (for example Prisma Postgres or Neon from the Vercel Marketplace).
   - `AUTH_SECRET`: generate with `npx auth secret`.
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`: a Google OAuth client with redirect URI
     `http://localhost:3000/api/auth/callback/google` (plus your production URL).
   - `ALLOWED_EMAILS`: the Google account(s) allowed to sign in.
2. Install and migrate:

```bash
npm install
npm run db:migrate   # applies prisma/migrations
npm run dev          # http://localhost:3000
npm run check        # lint, typecheck, tests, build
```

On Vercel, set the same environment variables and run `npm run db:deploy` against the production database.

Project context lives in `AGENTS.md`, `PROJECT_DECISIONS.md`, and `PROJECT_PROGRESS.md`.
