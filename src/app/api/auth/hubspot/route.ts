import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getHubSpotAuthUrl } from "@/lib/hubspot/auth";
import { logger } from "@/lib/logger";

/* GET /api/auth/hubspot?instanceId=xxx -- Initiates the HubSpot OAuth flow. Returns the authorization URL that the frontend should redirect/open. */
export async function GET(request: NextRequest) {
  try {
    const instanceId = request.nextUrl.searchParams.get("instanceId");

    if (!instanceId) {
      return NextResponse.json(
        { success: false, error: "Missing instanceId" },
        { status: 400 }
      );
    }

    // Find or create the Wix connection (auto-create in demo/dev mode)
    let wixConnection = await prisma.wixConnection.findUnique({
      where: { instanceId },
    });

    if (!wixConnection) {
      wixConnection = await prisma.wixConnection.create({
        data: {
          instanceId,
          accessToken: "pending",
          updatedAt: new Date(),
        },
      });
    }

    const authUrl = getHubSpotAuthUrl(instanceId);

    logger.info("HubSpot OAuth initiated", { instanceId });

    return NextResponse.json({
      success: true,
      data: { authUrl },
    });
  } catch (error) {
    logger.error("HubSpot auth initiation failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { success: false, error: "Failed to initiate HubSpot connection" },
      { status: 500 }
    );
  }
}
