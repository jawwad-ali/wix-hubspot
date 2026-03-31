import crypto from "crypto";

/**
 * Creates a deterministic SHA-256 hash of contact data.
 * Used for idempotency — if the hash matches the last synced hash,
 * it means nothing actually changed and we can skip the sync.
 *
 * Keys are sorted to ensure deterministic output regardless of insertion order.
 */
export function computeContactHash(data: Record<string, string>): string {
  const sorted = Object.keys(data)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});

  return crypto.createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}
