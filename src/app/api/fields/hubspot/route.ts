import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getValidHubSpotToken } from "@/lib/hubspot/auth";
import { createHubSpotClient } from "@/lib/hubspot/contacts";
import { getContactProperties } from "@/lib/hubspot/properties";
import { logger } from "@/lib/logger";

/**
 * GET /api/fields/hubspot?instanceId=xxx
 * Returns the list of writable HubSpot contact properties.
 * Fetched dynamically from HubSpot's Properties API.
 */
export async function GET(request: NextRequest) {
  try {
    const instanceId = request.nextUrl.searchParams.get("instanceId");

    if (!instanceId) {
      return NextResponse.json(
        { success: false, error: "Missing instanceId" },
        { status: 400 }
      );
    }

    const wixConnection = await prisma.wixConnection.findUnique({
      where: { instanceId },
    });

    if (!wixConnection) {
      return NextResponse.json(
        { success: false, error: "Wix connection not found" },
        { status: 404 }
      );
    }

    // Get a valid HubSpot token (auto-refreshes if needed)
    const accessToken = await getValidHubSpotToken(wixConnection.id);
    const client = createHubSpotClient(accessToken);

    const properties = await getContactProperties(client);

    // Transform to the format the field mapping UI expects
    const options = properties.map((p) => ({
      value: p.name,
      label: p.label,
      group: p.groupName,
    }));

    return NextResponse.json({
      success: true,
      data: options,
    });
  } catch (error) {
    logger.error("Failed to fetch HubSpot properties", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { success: false, error: "Failed to fetch HubSpot properties" },
      { status: 500 }
    );
  }
}
