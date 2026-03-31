import crypto from "crypto";
import { logger } from "@/lib/logger";

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000; // 5 minutes

/* Verifies a HubSpot webhook using v3 signature verification. Checks timestamp for replay protection, computes HMAC-SHA256 with HUBSPOT_CLIENT_SECRET, and compares with X-HubSpot-Signature-v3 header. Skips verification if HUBSPOT_CLIENT_SECRET is not set. */
export function verifyHubSpotWebhook(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  requestUrl: string
): void {
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  if (!clientSecret) {
    logger.warn("HUBSPOT_CLIENT_SECRET not set — skipping webhook verification");
    return;
  }

  if (!signatureHeader || !timestampHeader) {
    throw new Error("Missing HubSpot signature headers");
  }

  // Step 1: Replay protection
  const timestamp = parseInt(timestampHeader, 10);
  const now = Date.now();
  if (now - timestamp > MAX_TIMESTAMP_AGE_MS) {
    throw new Error("HubSpot webhook timestamp too old (possible replay attack)");
  }

  // Step 2: Build the source string
  const sourceString = `POST${requestUrl}${rawBody}${timestampHeader}`;

  // Step 3: HMAC-SHA256
  const hmac = crypto.createHmac("sha256", clientSecret);
  hmac.update(sourceString);

  // Step 4: Base64 encode
  const computedSignature = hmac.digest("base64");

  // Step 5: Compare (timing-safe)
  const sigBuffer = Buffer.from(signatureHeader);
  const computedBuffer = Buffer.from(computedSignature);

  if (
    sigBuffer.length !== computedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, computedBuffer)
  ) {
    logger.error("HubSpot webhook signature mismatch");
    throw new Error("Invalid HubSpot webhook signature");
  }
}
