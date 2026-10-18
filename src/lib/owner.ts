import "server-only";

import { getOwnerEmail } from "@/lib/env";
import { getShellUser } from "@/lib/queries";

/** Whether the signed-in user is the app's owner (`OWNER_EMAIL`), who sees the wizard preview and the feedback inbox. */
export async function isOwner(userId: string) {
  const owner = getOwnerEmail();
  if (!owner) return false;
  const { email } = await getShellUser(userId);
  return email?.toLowerCase() === owner;
}
