import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/auth/hubspot-status?instanceId=xxx
 * Checks if HubSpot is connected for a given Wix instance.
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
      include: { hubspotConnection: true },
    });

    if (!wixConnection) {
      return NextResponse.json({
        success: true,
        data: { connected: false, reason: "no_wix_connection" },
      });
    }

    if (!wixConnection.hubspotConnection) {
      return NextResponse.json({
        success: true,
        data: { connected: false, reason: "hubspot_not_connected" },
      });
    }

    const hs = wixConnection.hubspotConnection;
    const isExpired = hs.tokenExpiresAt < new Date();

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        portalId: hs.portalId,
        connectedAt: hs.createdAt,
        tokenStatus: isExpired ? "expired_will_refresh" : "valid",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to check status" },
      { status: 500 }
    );
  }
}
