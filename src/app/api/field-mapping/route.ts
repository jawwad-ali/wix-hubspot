import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/* GET /api/field-mapping?instanceId=xxx -- Returns all field mappings for a Wix connection. */
export async function GET(request: NextRequest) {
  try {
    const instanceId = request.nextUrl.searchParams.get("instanceId");

    if (!instanceId) {
      return NextResponse.json({ success: false, error: "Missing instanceId" }, { status: 400 });
    }

    const wixConnection = await prisma.wixConnection.findUnique({
      where: { instanceId },
    });

    if (!wixConnection) {
      return NextResponse.json({ success: false, error: "Connection not found" }, { status: 404 });
    }

    const mappings = await prisma.fieldMapping.findMany({
      where: { wixConnectionId: wixConnection.id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ success: true, data: mappings });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch mappings" }, { status: 500 });
  }
}

/* POST /api/field-mapping -- Creates a new field mapping. */
export async function POST(request: NextRequest) {
  try {
    const { instanceId, wixField, hubspotProperty, direction, transform } = await request.json();

    if (!instanceId || !wixField || !hubspotProperty || !direction) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const wixConnection = await prisma.wixConnection.findUnique({
      where: { instanceId },
    });

    if (!wixConnection) {
      return NextResponse.json({ success: false, error: "Connection not found" }, { status: 404 });
    }

    // Check for duplicate
    const existing = await prisma.fieldMapping.findFirst({
      where: {
        wixConnectionId: wixConnection.id,
        wixField,
        hubspotProperty,
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "This field mapping already exists" },
        { status: 409 }
      );
    }

    // Get next sort order
    const maxSort = await prisma.fieldMapping.findFirst({
      where: { wixConnectionId: wixConnection.id },
      orderBy: { sortOrder: "desc" },
    });

    const mapping = await prisma.fieldMapping.create({
      data: {
        wixConnectionId: wixConnection.id,
        wixField,
        hubspotProperty,
        direction,
        transform: transform || null,
        sortOrder: (maxSort?.sortOrder ?? -1) + 1,
      },
    });

    logger.info("Field mapping created", { mappingId: mapping.id });

    return NextResponse.json({ success: true, data: mapping }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to create mapping" }, { status: 500 });
  }
}

/* PUT /api/field-mapping -- Updates an existing field mapping. */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing mapping id" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.direction !== undefined) data.direction = body.direction;
    if (body.transform !== undefined) data.transform = body.transform;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const mapping = await prisma.fieldMapping.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: mapping });
  } catch (error) {
    logger.error("Failed to update mapping", { error: error instanceof Error ? error.message : "Unknown" });
    return NextResponse.json({ success: false, error: "Failed to update mapping" }, { status: 500 });
  }
}

/* DELETE /api/field-mapping -- Deletes a field mapping. */
export async function DELETE(request: NextRequest) {
  try {
    // Support both body JSON and query param
    let id: string | null = request.nextUrl.searchParams.get("id");
    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {
        // body parsing failed
      }
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing mapping id" }, { status: 400 });
    }

    await prisma.fieldMapping.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to delete mapping", { error: error instanceof Error ? error.message : "Unknown" });
    return NextResponse.json({ success: false, error: "Failed to delete mapping" }, { status: 500 });
  }
}
