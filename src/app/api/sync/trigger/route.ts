import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { createWixClient } from "@/lib/wix/auth";
import { getValidHubSpotToken } from "@/lib/hubspot/auth";
import { listAllWixContacts } from "@/lib/wix/contacts";
import { createHubSpotClient, listAllHubSpotContacts } from "@/lib/hubspot/contacts";
import { syncWixToHubSpot, syncHubSpotToWix } from "@/lib/sync/engine";
import { getMappedHubSpotProperties } from "@/lib/sync/mapper";

/**
 * POST /api/sync/trigger
 * Triggers a manual full sync between Wix and HubSpot.
 * Body: { instanceId, direction: "wix_to_hubspot" | "hubspot_to_wix" | "both" }
 */
export async function POST(request: NextRequest) {
  try {
    const { instanceId, direction = "both" } = await request.json();

    if (!instanceId) {
      return NextResponse.json(
        { success: false, error: "Missing instanceId" },
        { status: 400 }
      );
    }

    const wixConnection = await prisma.wixConnection.findUnique({
      where: { instanceId },
      include: { hubspotConnection: true },
    });

    if (!wixConnection || !wixConnection.hubspotConnection) {
      return NextResponse.json(
        { success: false, error: "Both Wix and HubSpot must be connected" },
        { status: 400 }
      );
    }

    const hasRealWixToken = wixConnection.accessToken !== "pending";

    const stats = {
      wixToHubspot: { created: 0, updated: 0, skipped: 0, errors: 0 },
      hubspotToWix: { created: 0, updated: 0, skipped: 0, errors: 0 },
    };

    // Load mappings
    const mappings = await prisma.fieldMapping.findMany({
      where: { wixConnectionId: wixConnection.id, isActive: true },
    });
    const mappingRules = mappings.map((m) => ({
      wixField: m.wixField,
      hubspotProperty: m.hubspotProperty,
      direction: m.direction,
      transform: m.transform as "lowercase" | "uppercase" | "trim" | null,
    }));

    // ─── Wix → HubSpot ───
    if ((direction === "wix_to_hubspot" || direction === "both") && hasRealWixToken) {
      try {
        const wixToken = decrypt(wixConnection.accessToken);
        const wixClient = createWixClient(wixToken);
        const wixContacts = await listAllWixContacts(wixClient);

        for (const contact of wixContacts) {
          const result = await syncWixToHubSpot(
            wixConnection.id,
            contact,
            "update",
            "manual"
          );
          if (result.action === "create") stats.wixToHubspot.created++;
          else if (result.action === "update") stats.wixToHubspot.updated++;
          else if (result.action === "error") stats.wixToHubspot.errors++;
          else stats.wixToHubspot.skipped++;
        }
      } catch (error) {
        logger.error("Wix → HubSpot sync failed", {
          error: error instanceof Error ? error.message : "Unknown",
        });
        stats.wixToHubspot.errors++;
      }
    }

    // ─── HubSpot → Wix ───
    if (direction === "hubspot_to_wix" || direction === "both") {
      try {
        const hsToken = await getValidHubSpotToken(wixConnection.id);
        const hsClient = createHubSpotClient(hsToken);
        const hsProperties = getMappedHubSpotProperties(mappingRules);
        const hsContacts = await listAllHubSpotContacts(hsClient, hsProperties);

        for (const contact of hsContacts) {
          // In demo mode (no real Wix token), log the contacts but skip Wix write
          if (!hasRealWixToken) {
            // Still log that we found HubSpot contacts to sync
            await prisma.syncLog.create({
              data: {
                wixConnectionId: wixConnection.id,
                direction: "hubspot_to_wix",
                action: "skip",
                hubspotContactId: contact.id,
                triggerSource: "manual",
                details: JSON.stringify({
                  reason: "wix_not_connected",
                  contactEmail: contact.properties.email,
                }),
              },
            });
            stats.hubspotToWix.skipped++;
            continue;
          }

          const result = await syncHubSpotToWix(
            wixConnection.id,
            contact.id,
            "update",
            "manual"
          );
          if (result.action === "create") stats.hubspotToWix.created++;
          else if (result.action === "update") stats.hubspotToWix.updated++;
          else if (result.action === "error") stats.hubspotToWix.errors++;
          else stats.hubspotToWix.skipped++;
        }
      } catch (error) {
        logger.error("HubSpot → Wix sync failed", {
          error: error instanceof Error ? error.message : "Unknown",
        });
        stats.hubspotToWix.errors++;
      }
    }

    logger.info("Manual sync completed", { instanceId, direction, stats });

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    logger.error("Manual sync failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { success: false, error: "Sync failed" },
      { status: 500 }
    );
  }
}
