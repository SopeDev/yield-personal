import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/env";

const globalForDatabase = globalThis as unknown as {
  prisma?: PrismaClient;
};

const adapter = new PrismaPg({ connectionString: getServerEnv().DATABASE_URL });

export const db = globalForDatabase.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.prisma = db;
}
