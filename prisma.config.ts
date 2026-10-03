import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.POSTGRES_URL || env("DATABASE_URL"),
  },
});
