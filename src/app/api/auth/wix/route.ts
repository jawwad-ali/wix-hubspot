import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { resolveInstanceFromDashboard, exchangeInstanceToken } from "@/lib/wix/auth";

/**
 * POST /api/auth/wix
 * Called by the dashboard frontend when the iframe loads.
 * Exchanges the Wix instance token for an access token and stores the connection.
 */
export async function POST(request: NextRequest) {
  try {
    const { instance } = await request.json();

    if (!instance) {
      return NextResponse.json({ success: false, error: "Missing instance token" }, { status: 400 });
    }

    // 1. Decode the instance token to get the instanceId
    const { instanceId, siteId } = await resolveInstanceFromDashboard(instance);

    if (!instanceId) {
      return NextResponse.json({ success: false, error: "Invalid instance token" }, { status: 400 });
    }

    // 2. Exchange for an access token
    const { accessToken } = await exchangeInstanceToken(instanceId);

    // 3. Encrypt and store
    const encryptedToken = encrypt(accessToken);

    const connection = await prisma.wixConnection.upsert({
      where: { instanceId },
      create: {
        instanceId,
        siteId,
        accessToken: encryptedToken,
      },
      update: {
        siteId,
        accessToken: encryptedToken,
        updatedAt: new Date(),
      },
    });

    logger.info("Wix connection established", { instanceId, connectionId: connection.id });

    return NextResponse.json({
      success: true,
      data: {
        connectionId: connection.id,
        instanceId,
      },
    });
  } catch (error) {
    logger.error("Wix auth failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { success: false, error: "Authentication failed" },
      { status: 500 }
    );
  }
}
