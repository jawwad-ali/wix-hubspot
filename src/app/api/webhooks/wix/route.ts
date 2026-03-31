import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { verifyWixWebhook } from "@/lib/wix/webhook-verify";
import { syncWixToHubSpot } from "@/lib/sync/engine";
import { WixContact } from "@/types";

/* POST /api/webhooks/wix -- Receives Wix contact webhooks. The body is a JWT string (NOT JSON). Must read as text, verify the JWT, then parse the event data. Supports contact_created and contact_updated events. */
export async function POST(request: NextRequest) {
  try {
    // CRITICAL: Read body as text, not JSON. Wix sends a raw JWT string.
    const rawBody = await request.text();

    if (!rawBody) {
      return NextResponse.json({ error: "Empty body" }, { status: 400 });
    }

    // Verify and decode the webhook JWT
    const { eventType, instanceId, data } = verifyWixWebhook(rawBody);

    logger.info("Wix webhook received", { eventType, instanceId });

    // Find the Wix connection
    const wixConnection = await prisma.wixConnection.findUnique({
      where: { instanceId },
      include: { hubspotConnection: true },
    });

    if (!wixConnection) {
      // App may be uninstalled — acknowledge and ignore
      logger.warn("Wix webhook for unknown instance", { instanceId });
      return NextResponse.json({ received: true });
    }

    if (!wixConnection.hubspotConnection) {
      // HubSpot not connected yet — nothing to sync to
      logger.info("Wix webhook ignored — HubSpot not connected", { instanceId });
      return NextResponse.json({ received: true });
    }

    // Parse the contact data from the event
    let contactData: WixContact;
    try {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      contactData = parsed.contact || parsed;
    } catch {
      logger.error("Failed to parse Wix webhook data", { eventType });
      return NextResponse.json({ received: true });
    }

    // Determine the action based on event type
    let action: "create" | "update";

    switch (eventType) {
      case "wix.contacts.v4.contact_created":
        action = "create";
        break;
      case "wix.contacts.v4.contact_updated":
        action = "update";
        break;
      default:
        logger.info("Unhandled Wix event type", { eventType });
        return NextResponse.json({ received: true });
    }

    // Trigger the sync (non-blocking for fast webhook response)
    syncWixToHubSpot(wixConnection.id, contactData, action, "webhook").catch(
      (error) => {
        logger.error("Background sync Wix → HubSpot failed", {
          error: error instanceof Error ? error.message : "Unknown",
          contactId: contactData.id,
        });
      }
    );

    // Return 200 immediately — Wix expects fast responses
    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Wix webhook handler error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // Return 200 even on error to prevent Wix from retrying endlessly
    return NextResponse.json({ received: true });
  }
}
