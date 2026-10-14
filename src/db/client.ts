import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { withEncryption, type EncryptedClient } from "@/db/encryption";
import { getDatabaseUrl } from "@/lib/env";

const MAX_CONNECTIONS = 4;

const globalForDatabase = globalThis as unknown as {
  prisma?: EncryptedClient;
};

function getClient() {
  if (!globalForDatabase.prisma) {
    // A few connections are enough for a page's parallel queries; more would each cost a new TLS handshake on a cold start.
    // Amounts, names and notes are encrypted at rest; the client encrypts them on write and decrypts them on read.
    globalForDatabase.prisma = withEncryption(new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl(), max: MAX_CONNECTIONS }) }));
  }
  return globalForDatabase.prisma;
}

/**
 * The client is created on first use rather than at import, so building the app (which imports
 * route modules) does not require database credentials.
 */
export const db = new Proxy({} as EncryptedClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
