import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/* GET /api/sync/status?instanceId=xxx -- Returns sync statistics for the dashboard. */
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
        { success: false, error: "Connection not found" },
        { status: 404 }
      );
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalMappings,
      lastSync,
      successCount24h,
      errorCount24h,
      recentLogs,
    ] = await Promise.all([
      prisma.contactMapping.count({
        where: { wixConnectionId: wixConnection.id },
      }),
      prisma.syncLog.findFirst({
        where: { wixConnectionId: wixConnection.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.syncLog.count({
        where: {
          wixConnectionId: wixConnection.id,
          action: { not: "error" },
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
      prisma.syncLog.count({
        where: {
          wixConnectionId: wixConnection.id,
          action: "error",
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
      prisma.syncLog.findMany({
        where: { wixConnectionId: wixConnection.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalContactsSynced: totalMappings,
        lastSyncTime: lastSync?.createdAt || null,
        successfulSyncs24h: successCount24h,
        errors24h: errorCount24h,
        recentActivity: recentLogs,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch sync status" },
      { status: 500 }
    );
  }
}
