import { ContactMapping } from "@prisma/client";

/* Resolves sync conflicts using Last Write Wins strategy. No existing mapping proceeds, matching hash skips, newer timestamp proceeds, older or equal timestamp skips. */
export function resolveConflict(
  incomingTimestamp: Date,
  existingMapping: ContactMapping | null,
  incomingHash: string
): "proceed" | "skip" {
  // Rule 1: No existing mapping — this is a new contact pair
  if (!existingMapping) {
    return "proceed";
  }

  // Rule 2: Hash matches — data is identical, no need to sync
  if (existingMapping.lastSyncHash === incomingHash) {
    return "skip";
  }

  // Rule 3 & 4: Compare timestamps — last write wins
  if (incomingTimestamp > existingMapping.lastSyncedAt) {
    return "proceed";
  }

  return "skip";
}
