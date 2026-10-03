import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  ALLOWED_EMAILS: z.string().min(1),
  APP_TIME_ZONE: z.string().min(1).default("America/Tijuana"),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
    APP_TIME_ZONE: process.env.APP_TIME_ZONE || undefined,
  });
}

export function isAllowedEmail(email: string | null | undefined) {
  if (!email) return false;
  const allowed = getServerEnv().ALLOWED_EMAILS.split(",").map((value) => value.trim().toLowerCase());
  return allowed.includes(email.toLowerCase());
}
