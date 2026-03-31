import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/hubspot/disconnect
 * Disconnects the HubSpot account from a Wix instance.
 * Removes the HubSpotConnection record (tokens are deleted).
 */
export async function POST(request: NextRequest) {
  try {
    const { instanceId } = await request.json();

    if (!instanceId) {
      return NextResponse.json({ success: false, error: "Missing instanceId" }, { status: 400 });
    }

    const wixConnection = await prisma.wixConnection.findUnique({
      where: { instanceId },
      include: { hubspotConnection: true },
    });

    if (!wixConnection || !wixConnection.hubspotConnection) {
      return NextResponse.json({ success: true }); // Already disconnected
    }

    // Delete the HubSpot connection (cascades encrypted tokens)
    await prisma.hubSpotConnection.delete({
      where: { id: wixConnection.hubspotConnection.id },
    });

    logger.info("HubSpot disconnected", { instanceId });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to disconnect HubSpot", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ success: false, error: "Failed to disconnect" }, { status: 500 });
  }
}
