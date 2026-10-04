import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

/**
 * Migrations must use a direct connection. `prisma migrate` holds a session-level advisory lock, and through
 * Prisma Postgres's pooler that lock can outlive the migration and block every later deploy (P1002). A pooled
 * Prisma Postgres URL is therefore switched to its direct host.
 */
function directUrl(url: string) {
  return url.replace("@pooled.db.prisma.io", "@db.prisma.io");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl(process.env.DIRECT_URL || process.env.POSTGRES_URL || env("DATABASE_URL")),
  },
});
