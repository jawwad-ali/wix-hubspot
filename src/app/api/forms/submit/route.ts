import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { getValidHubSpotToken } from "@/lib/hubspot/auth";
import {
  createHubSpotClient,
  createHubSpotContact,
  updateHubSpotContact,
  searchHubSpotContactByEmail,
} from "@/lib/hubspot/contacts";
import { ensureUtmProperties } from "@/lib/hubspot/utm-properties";
import { createWixClient } from "@/lib/wix/auth";
import {
  createWixContact,
  updateWixContact,
  findWixContactByEmail,
} from "@/lib/wix/contacts";
import { markAsSynced } from "@/lib/sync/loop-prevention";
import { computeContactHash } from "@/lib/sync/hash";

/* POST /api/forms/submit -- Receives form submissions with contact data and UTM attribution. Creates/updates the contact in HubSpot (and Wix if connected), preserving UTM parameters for marketing attribution. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      instanceId,
      email,
      firstName,
      lastName,
      phone,
      company,
      customFields,
      utm = {},
      pageUrl,
      referrer,
    } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    if (!instanceId) {
      return NextResponse.json(
        { success: false, error: "instanceId is required" },
        { status: 400 }
      );
    }

    // Find or create connection for this instance
    let wixConnection = await prisma.wixConnection.findUnique({
      where: { instanceId },
      include: { hubspotConnection: true },
    });

    // If no HubSpot connection on this instance, try to find any connected instance
    // This handles the case where form uses instanceId=demo but HubSpot is on the real Wix instance
    if (!wixConnection?.hubspotConnection) {
      const connectedInstance = await prisma.wixConnection.findFirst({
        where: { hubspotConnection: { isNot: null } },
        include: { hubspotConnection: true },
      });
      if (connectedInstance) {
        wixConnection = connectedInstance;
      }
    }

    if (!wixConnection) {
      wixConnection = await prisma.wixConnection.create({
        data: { instanceId, accessToken: "pending", updatedAt: new Date() },
        include: { hubspotConnection: true },
      });
    }

    // Save the form submission record
    const submission = await prisma.formSubmission.create({
      data: {
        wixConnectionId: wixConnection.id,
        email,
        firstName,
        lastName,
        phone,
        company,
        customFields: customFields ? JSON.stringify(customFields) : null,
        utmSource: utm.source,
        utmMedium: utm.medium,
        utmCampaign: utm.campaign,
        utmTerm: utm.term,
        utmContent: utm.content,
        pageUrl,
        referrer,
      },
    });

    let hubspotContactId: string | undefined;
    let wixContactId: string | undefined;

    // ─── Sync to HubSpot ───
    if (wixConnection.hubspotConnection) {
      try {
        const hsToken = await getValidHubSpotToken(wixConnection.id);
        const hsClient = createHubSpotClient(hsToken);

        // Step 1: Ensure UTM custom properties exist in HubSpot
        const availableProps = await ensureUtmProperties(hsClient);

        // Step 2: Build contact properties — only standard writable fields
        const hubspotProperties: Record<string, string> = { email };
        if (firstName) hubspotProperties.firstname = firstName;
        if (lastName) hubspotProperties.lastname = lastName;
        if (phone) hubspotProperties.phone = phone;
        if (company) hubspotProperties.company = company;

        // Step 3: Add UTM properties only if they exist in HubSpot
        if (utm.source && availableProps.has("utm_source"))
          hubspotProperties.utm_source = utm.source;
        if (utm.medium && availableProps.has("utm_medium"))
          hubspotProperties.utm_medium = utm.medium;
        if (utm.campaign && availableProps.has("utm_campaign"))
          hubspotProperties.utm_campaign = utm.campaign;
        if (utm.term && availableProps.has("utm_term"))
          hubspotProperties.utm_term = utm.term;
        if (utm.content && availableProps.has("utm_content"))
          hubspotProperties.utm_content = utm.content;
        if (pageUrl && availableProps.has("form_page_url"))
          hubspotProperties.form_page_url = pageUrl;
        if (referrer && availableProps.has("form_referrer"))
          hubspotProperties.form_referrer = referrer;

        // Step 4: Create or update the contact
        const existingContact = await searchHubSpotContactByEmail(hsClient, email);

        if (existingContact) {
          await updateHubSpotContact(hsClient, existingContact.id, hubspotProperties);
          hubspotContactId = existingContact.id;
        } else {
          const newContact = await createHubSpotContact(hsClient, hubspotProperties);
          hubspotContactId = newContact.id;
        }

        // Mark as synced to prevent webhook echo
        if (hubspotContactId) {
          const hash = computeContactHash(hubspotProperties);
          await markAsSynced(`hubspot:${hubspotContactId}`, "wix", hash);
        }

        logger.info("Form submission synced to HubSpot", {
          email,
          hubspotContactId,
          utmPropsAvailable: availableProps.size,
        });
      } catch (error) {
        logger.error("Failed to sync form to HubSpot", {
          error: error instanceof Error ? error.message : "Unknown",
          email,
        });
      }
    }

    // ─── Sync to Wix (skip in demo mode where token is "pending") ───
    if (wixConnection.accessToken !== "pending") {
      try {
        const wixToken = decrypt(wixConnection.accessToken);
        const wixClient = createWixClient(wixToken);

        const wixInfo = {
          emails: [{ email, tag: "MAIN" as const }],
          ...(firstName || lastName
            ? { name: { first: firstName, last: lastName } }
            : {}),
          ...(phone ? { phones: [{ phone, tag: "MAIN" as const }] } : {}),
          ...(company ? { company } : {}),
        };

        const existingWixContact = await findWixContactByEmail(wixClient, email);

        if (existingWixContact) {
          await updateWixContact(
            wixClient,
            existingWixContact.id,
            wixInfo,
            existingWixContact.revision
          );
          wixContactId = existingWixContact.id;
        } else {
          const newContact = await createWixContact(wixClient, wixInfo);
          wixContactId = newContact.id;
        }

        if (wixContactId) {
          const hash = computeContactHash({ email, firstName: firstName || "", lastName: lastName || "" });
          await markAsSynced(`wix:${wixContactId}`, "wix", hash);
        }
      } catch (error) {
        logger.error("Failed to sync form to Wix", {
          error: error instanceof Error ? error.message : "Unknown",
          email,
        });
      }
    }

    // ─── Create contact mapping if both IDs exist ───
    if (wixContactId && hubspotContactId) {
      await prisma.contactMapping.upsert({
        where: {
          wixConnectionId_wixContactId: {
            wixConnectionId: wixConnection.id,
            wixContactId,
          },
        },
        create: {
          wixConnectionId: wixConnection.id,
          wixContactId,
          hubspotContactId,
          lastSyncedAt: new Date(),
          lastSyncSource: "wix",
          lastSyncHash: computeContactHash({ email }),
        },
        update: {
          hubspotContactId,
          lastSyncedAt: new Date(),
          lastSyncSource: "wix",
        },
      });
    }

    // ─── Update submission status ───
    await prisma.formSubmission.update({
      where: { id: submission.id },
      data: {
        hubspotContactId,
        syncStatus: hubspotContactId ? "synced" : "error",
        syncedAt: hubspotContactId ? new Date() : null,
        syncError: !hubspotContactId ? "HubSpot sync failed" : null,
      },
    });

    // ─── Log the operation ───
    await prisma.syncLog.create({
      data: {
        wixConnectionId: wixConnection.id,
        direction: "wix_to_hubspot",
        action: hubspotContactId ? "create" : "error",
        wixContactId,
        hubspotContactId,
        triggerSource: "form",
        details: JSON.stringify({ email, utm, pageUrl, referrer }),
        errorMessage: !hubspotContactId ? "HubSpot not connected or sync failed" : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        submissionId: submission.id,
        hubspotContactId,
        wixContactId,
      },
    });
  } catch (error) {
    logger.error("Form submission failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { success: false, error: "Failed to process form submission" },
      { status: 500 }
    );
  }
}
