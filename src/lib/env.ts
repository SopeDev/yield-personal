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
