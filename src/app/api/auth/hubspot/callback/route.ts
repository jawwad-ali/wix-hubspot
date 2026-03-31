import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/encryption";
import { exchangeCodeForTokens, getPortalId } from "@/lib/hubspot/auth";
import { logger } from "@/lib/logger";

// Default field mappings seeded on first HubSpot connection
const DEFAULT_MAPPINGS = [
  { wixField: "info.name.first", hubspotProperty: "firstname", direction: "bidirectional" },
  { wixField: "info.name.last", hubspotProperty: "lastname", direction: "bidirectional" },
  { wixField: "info.emails.0.email", hubspotProperty: "email", direction: "bidirectional" },
  { wixField: "info.phones.0.phone", hubspotProperty: "phone", direction: "bidirectional" },
  { wixField: "info.company", hubspotProperty: "company", direction: "bidirectional" },
  { wixField: "info.jobTitle", hubspotProperty: "jobtitle", direction: "bidirectional" },
  { wixField: "info.addresses.0.city", hubspotProperty: "city", direction: "bidirectional" },
  { wixField: "info.addresses.0.country", hubspotProperty: "country", direction: "bidirectional" },
];

/**
 * GET /api/auth/hubspot/callback?code=xxx&state=xxx
 * HubSpot redirects here after user authorizes.
 * Exchanges code for tokens, stores them encrypted, seeds default field mappings.
 */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=missing_params`
      );
    }

    // 1. Decrypt state to get the Wix instanceId
    let instanceId: string;
    try {
      instanceId = decrypt(state);
    } catch {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=invalid_state`
      );
    }

    // 2. Find the Wix connection
    const wixConnection = await prisma.wixConnection.findUnique({
      where: { instanceId },
    });

    if (!wixConnection) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=no_wix_connection`
      );
    }

    // 3. Exchange code for tokens
    const { accessToken, refreshToken, expiresIn } = await exchangeCodeForTokens(code);

    // 4. Get the portal ID
    const portalId = await getPortalId(accessToken);

    // 5. Encrypt and store
    const encryptedAccessToken = encrypt(accessToken);
    const encryptedRefreshToken = encrypt(refreshToken);
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    const scopes = process.env.HUBSPOT_SCOPES || "crm.objects.contacts.read crm.objects.contacts.write";

    await prisma.hubSpotConnection.upsert({
      where: { wixConnectionId: wixConnection.id },
      create: {
        wixConnectionId: wixConnection.id,
        portalId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        scopes,
      },
      update: {
        portalId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        scopes,
      },
    });

    // 6. Seed default field mappings if none exist
    const existingMappings = await prisma.fieldMapping.count({
      where: { wixConnectionId: wixConnection.id },
    });

    if (existingMappings === 0) {
      await prisma.fieldMapping.createMany({
        data: DEFAULT_MAPPINGS.map((m, i) => ({
          wixConnectionId: wixConnection.id,
          wixField: m.wixField,
          hubspotProperty: m.hubspotProperty,
          direction: m.direction,
          sortOrder: i,
        })),
      });
      logger.info("Seeded default field mappings", {
        connectionId: wixConnection.id,
        count: DEFAULT_MAPPINGS.length,
      });
    }

    logger.info("HubSpot connection established", {
      instanceId,
      portalId,
    });

    // 7. Redirect back to dashboard with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?instanceId=${instanceId}&connected=true`
    );
  } catch (error) {
    logger.error("HubSpot OAuth callback failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=oauth_failed`
    );
  }
}
