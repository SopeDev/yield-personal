/**
 * Encrypts what the database still holds only in plaintext. Runs on every deploy, after migrations and before the
 * build, so the new version never goes live without its key: a missing or different key fails the deploy and the
 * current version keeps serving.
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { encryptExisting } from "../src/db/encrypt-existing";
import { getDatabaseUrl } from "../src/lib/env";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  if (!process.env.DATA_ENCRYPTION_KEY) {
    throw new Error("DATA_ENCRYPTION_KEY is not configured: set it (generate with `openssl rand -base64 32`) and deploy again.");
  }
  const base = new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });
  try {
    const written = await encryptExisting(base);
    const total = Object.values(written).reduce((sum, count) => sum + count, 0);
    console.log(total === 0 ? "Encryption: everything already encrypted." : `Encryption: encrypted ${total} values ${JSON.stringify(written)}.`);
  } finally {
    await base.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
