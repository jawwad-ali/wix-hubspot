import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const DEDUPE_WINDOW_MS = 30_000; // 30 seconds

/**
 * Checks if a sync operation for this contact was recently performed.
 * If a contact was just synced FROM the other system in the last 30 seconds,
 * the incoming webhook is likely an echo of our own write — skip it.
 *
 * Example: We sync a contact from HubSpot → Wix. Wix fires a contact.updated webhook.
 * The dedupe entry "wix:{contactId}" with source "hubspot" exists → we skip,
 * preventing the infinite loop.
 */
export async function isDuplicate(contactKey: string): Promise<boolean> {
  const entry = await prisma.syncDedupeEntry.findFirst({
    where: {
      contactKey,
      expiresAt: { gt: new Date() },
    },
  });

  if (entry) {
    logger.debug("Dedupe hit — skipping echo", { contactKey, source: entry.sourceSystem });
    return true;
  }

  return false;
}

/**
 * Marks a contact as recently synced, creating a dedupe entry with a 30-second TTL.
 * The contactKey should be the TARGET system's ID (the system we just wrote to).
 *
 * Example: After writing to HubSpot, mark "hubspot:{hubspotContactId}" so that
 * the HubSpot webhook for this change will be recognized as our own echo.
 */
export async function markAsSynced(
  contactKey: string,
  sourceSystem: "wix" | "hubspot",
  operationHash: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + DEDUPE_WINDOW_MS);

  await prisma.syncDedupeEntry.upsert({
    where: {
      contactKey_operationHash: {
        contactKey,
        operationHash,
      },
    },
    create: {
      contactKey,
      sourceSystem,
      operationHash,
      expiresAt,
    },
    update: {
      expiresAt,
    },
  });
}

/**
 * Removes expired dedupe entries from the database.
 * Called periodically to prevent table bloat.
 */
export async function cleanupExpired(): Promise<number> {
  const result = await prisma.syncDedupeEntry.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}
