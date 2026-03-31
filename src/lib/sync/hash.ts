import crypto from "crypto";

/* Creates a deterministic SHA-256 hash of contact data. Used for idempotency -- if the hash matches the last synced hash, nothing changed and we can skip the sync. Keys are sorted for deterministic output. */
export function computeContactHash(data: Record<string, string>): string {
  const sorted = Object.keys(data)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});

  return crypto.createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}
