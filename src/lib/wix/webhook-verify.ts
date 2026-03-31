import jwt from "jsonwebtoken";
import { logger } from "@/lib/logger";

interface WixWebhookPayload {
  eventType: string;
  instanceId: string;
  data: string; // JSON string of the actual event data
}

/**
 * Verifies and decodes a Wix webhook.
 *
 * Wix webhooks arrive as a JWT string in the raw POST body (NOT JSON).
 * The JWT is signed with Wix's public key configured in the app dashboard.
 *
 * If WIX_PUBLIC_KEY is not set, we skip verification (development mode)
 * but still decode the payload.
 */
export function verifyWixWebhook(rawBody: string): WixWebhookPayload {
  const publicKey = process.env.WIX_PUBLIC_KEY;

  let decoded: Record<string, unknown>;

  if (publicKey) {
    // Verify JWT signature with Wix's public key
    try {
      decoded = jwt.verify(rawBody.trim(), publicKey, {
        algorithms: ["RS256"],
      }) as Record<string, unknown>;
    } catch (error) {
      logger.error("Wix webhook JWT verification failed", {
        error: error instanceof Error ? error.message : "Unknown",
      });
      throw new Error("Invalid webhook signature");
    }
  } else {
    // Development mode — decode without verification
    logger.warn("WIX_PUBLIC_KEY not set — skipping webhook verification");
    decoded = jwt.decode(rawBody.trim()) as Record<string, unknown>;
    if (!decoded) {
      throw new Error("Failed to decode webhook JWT");
    }
  }

  return {
    eventType: decoded.eventType as string,
    instanceId: decoded.instanceId as string,
    data: decoded.data as string,
  };
}
