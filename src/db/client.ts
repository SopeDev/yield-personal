import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseUrl } from "@/lib/env";

const globalForDatabase = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getClient() {
  if (!globalForDatabase.prisma) {
    globalForDatabase.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });
  }
  return globalForDatabase.prisma;
}

/**
 * The client is created on first use rather than at import, so building the app (which imports
 * route modules) does not require database credentials.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
