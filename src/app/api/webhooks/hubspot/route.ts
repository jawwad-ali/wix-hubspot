import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { verifyHubSpotWebhook } from "@/lib/hubspot/webhook-verify";
import { syncHubSpotToWix } from "@/lib/sync/engine";
import { HubSpotWebhookEvent } from "@/types";

/**
 * POST /api/webhooks/hubspot
 *
 * Receives HubSpot webhook events.
 * Body is a JSON array of event objects.
 * Verified using HMAC-SHA256 v3 signature.
 *
 * Supported subscription types:
 * - contact.creation
 * - contact.propertyChange
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-hubspot-signature-v3");
    const timestampHeader = request.headers.get("x-hubspot-request-timestamp");
    const requestUrl = request.url;

    // Verify the webhook signature
    try {
      verifyHubSpotWebhook(rawBody, signatureHeader, timestampHeader, requestUrl);
    } catch (error) {
      logger.error("HubSpot webhook verification failed", {
        error: error instanceof Error ? error.message : "Unknown",
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse the events array
    const events: HubSpotWebhookEvent[] = JSON.parse(rawBody);

    logger.info("HubSpot webhook received", { eventCount: events.length });

    // Process each event
    for (const event of events) {
      const portalId = event.portalId.toString();

      // Find the connection by portal ID
      const hubspotConnection = await prisma.hubSpotConnection.findFirst({
        where: { portalId },
      });

      if (!hubspotConnection) {
        logger.warn("HubSpot webhook for unknown portal", { portalId });
        continue;
      }

      const contactId = event.objectId.toString();
      let action: "create" | "update";

      switch (event.subscriptionType) {
        case "contact.creation":
          action = "create";
          break;
        case "contact.propertyChange":
          action = "update";
          break;
        default:
          logger.info("Unhandled HubSpot event type", {
            subscriptionType: event.subscriptionType,
          });
          continue;
      }

      // Trigger the sync (non-blocking)
      syncHubSpotToWix(
        hubspotConnection.wixConnectionId,
        contactId,
        action,
        "webhook"
      ).catch((error) => {
        logger.error("Background sync HubSpot → Wix failed", {
          error: error instanceof Error ? error.message : "Unknown",
          contactId,
        });
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("HubSpot webhook handler error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ received: true });
  }
}
