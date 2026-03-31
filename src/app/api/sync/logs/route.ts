import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/* GET /api/sync/logs?instanceId=xxx&page=1&limit=20 -- Returns paginated sync logs. */
export async function GET(request: NextRequest) {
  try {
    const instanceId = request.nextUrl.searchParams.get("instanceId");
    const page = parseInt(request.nextUrl.searchParams.get("page") || "1", 10);
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20", 10);

    if (!instanceId) {
      return NextResponse.json({ success: false, error: "Missing instanceId" }, { status: 400 });
    }

    const wixConnection = await prisma.wixConnection.findUnique({
      where: { instanceId },
    });

    if (!wixConnection) {
      return NextResponse.json({ success: false, error: "Connection not found" }, { status: 404 });
    }

    const logs = await prisma.syncLog.findMany({
      where: { wixConnectionId: wixConnection.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch logs" }, { status: 500 });
  }
}
