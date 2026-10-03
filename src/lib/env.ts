// Each setting is read where it is used, so a missing variable fails only the feature that needs it
// and never the build.

const DEFAULT_TIME_ZONE = "America/Tijuana";

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL (or POSTGRES_URL) is not configured");
  return url;
}

export function getAppTimeZone() {
  return process.env.APP_TIME_ZONE || DEFAULT_TIME_ZONE;
}

/** Without ALLOWED_EMAILS nobody can sign in: the app holds private financial data, so it fails closed. */
export function isAllowedEmail(email: string | null | undefined) {
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0) {
    console.error("ALLOWED_EMAILS is not configured; refusing all sign-ins.");
    return false;
  }

  return Boolean(email) && allowed.includes(email!.toLowerCase());
}
