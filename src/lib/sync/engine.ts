import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { createWixClient } from "@/lib/wix/auth";
import {
  getWixContact,
  createWixContact,
  updateWixContact,
  findWixContactByEmail,
} from "@/lib/wix/contacts";
import { getValidHubSpotToken } from "@/lib/hubspot/auth";
import {
  createHubSpotClient,
  getHubSpotContact,
  createHubSpotContact,
  updateHubSpotContact,
  searchHubSpotContactByEmail,
} from "@/lib/hubspot/contacts";
import { computeContactHash } from "./hash";
import { isDuplicate, markAsSynced, cleanupExpired } from "./loop-prevention";
import { resolveConflict } from "./conflict";
import {
  mapWixToHubSpot,
  mapHubSpotToWix,
  getMappedHubSpotProperties,
  getValueFromWixContact,
} from "./mapper";
import { SyncResult, WixContact, TriggerSource } from "@/types";
import { FieldMapping } from "@prisma/client";

// ─── Helper: Build sync context ───

async function getFieldMappings(wixConnectionId: string) {
  const mappings = await prisma.fieldMapping.findMany({
    where: { wixConnectionId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return mappings.map((m) => ({
    wixField: m.wixField,
    hubspotProperty: m.hubspotProperty,
    direction: m.direction,
    transform: m.transform as "lowercase" | "uppercase" | "trim" | null,
  }));
}

async function logSync(
  wixConnectionId: string,
  result: SyncResult,
  triggerSource: TriggerSource,
  details?: Record<string, unknown>
) {
  await prisma.syncLog.create({
    data: {
      wixConnectionId,
      direction: result.direction,
      action: result.action,
      wixContactId: result.wixContactId,
      hubspotContactId: result.hubspotContactId,
      triggerSource,
      details: details ? JSON.stringify(details) : null,
      errorMessage: result.error,
    },
  });
}

// ─── Wix → HubSpot Sync ───

/* Syncs a Wix contact change to HubSpot. Flow: dedupe check, map fields, hash check, conflict resolution, create/update in HubSpot, mark dedupe, update contact mapping, log the operation. */
export async function syncWixToHubSpot(
  wixConnectionId: string,
  wixContact: WixContact,
  action: "create" | "update",
  triggerSource: TriggerSource
): Promise<SyncResult> {
  const direction = "wix_to_hubspot" as const;

  try {
    // Clean up expired dedupe entries
    await cleanupExpired();

    // Step 1: Dedupe check
    const dedupeKey = `wix:${wixContact.id}`;
    if (await isDuplicate(dedupeKey)) {
      const result: SyncResult = {
        success: true,
        action: "skip",
        direction,
        wixContactId: wixContact.id,
      };
      await logSync(wixConnectionId, result, triggerSource, { reason: "dedupe_hit" });
      return result;
    }

    // Load field mappings
    const mappings = await getFieldMappings(wixConnectionId);
    if (mappings.length === 0) {
      const result: SyncResult = {
        success: true,
        action: "skip",
        direction,
        wixContactId: wixContact.id,
      };
      await logSync(wixConnectionId, result, triggerSource, { reason: "no_mappings" });
      return result;
    }

    // Step 2: Map fields
    const mappedProperties = mapWixToHubSpot(wixContact, mappings);

    if (Object.keys(mappedProperties).length === 0) {
      const result: SyncResult = {
        success: true,
        action: "skip",
        direction,
        wixContactId: wixContact.id,
      };
      await logSync(wixConnectionId, result, triggerSource, { reason: "no_mapped_values" });
      return result;
    }

    // Step 3: Hash check
    const hash = computeContactHash(mappedProperties);
    const existingMapping = await prisma.contactMapping.findUnique({
      where: {
        wixConnectionId_wixContactId: {
          wixConnectionId,
          wixContactId: wixContact.id,
        },
      },
    });

    // Step 4: Conflict resolution
    const incomingTimestamp = new Date(wixContact.updatedDate || wixContact.createdDate);
    const decision = resolveConflict(incomingTimestamp, existingMapping, hash);

    if (decision === "skip") {
      const result: SyncResult = {
        success: true,
        action: "skip",
        direction,
        wixContactId: wixContact.id,
        hubspotContactId: existingMapping?.hubspotContactId,
      };
      await logSync(wixConnectionId, result, triggerSource, { reason: "conflict_skip" });
      return result;
    }

    // Step 5: Get HubSpot client and create/update
    const hsToken = await getValidHubSpotToken(wixConnectionId);
    const hsClient = createHubSpotClient(hsToken);

    let hubspotContactId: string;

    if (existingMapping) {
      // We know the HubSpot contact ID — update it
      await updateHubSpotContact(hsClient, existingMapping.hubspotContactId, mappedProperties);
      hubspotContactId = existingMapping.hubspotContactId;
    } else {
      // No mapping exists — search by email first
      const email = getValueFromWixContact(wixContact, "info.emails.0.email");
      let existingHsContact = email
        ? await searchHubSpotContactByEmail(hsClient, email)
        : null;

      if (existingHsContact) {
        await updateHubSpotContact(hsClient, existingHsContact.id, mappedProperties);
        hubspotContactId = existingHsContact.id;
      } else {
        const newContact = await createHubSpotContact(hsClient, mappedProperties);
        hubspotContactId = newContact.id;
      }
    }

    // Step 6: Mark dedupe entry for the HubSpot side
    await markAsSynced(`hubspot:${hubspotContactId}`, "wix", hash);

    // Step 7: Update contact mapping
    await prisma.contactMapping.upsert({
      where: {
        wixConnectionId_wixContactId: {
          wixConnectionId,
          wixContactId: wixContact.id,
        },
      },
      create: {
        wixConnectionId,
        wixContactId: wixContact.id,
        hubspotContactId,
        lastSyncedAt: new Date(),
        lastSyncSource: "wix",
        lastSyncHash: hash,
      },
      update: {
        hubspotContactId,
        lastSyncedAt: new Date(),
        lastSyncSource: "wix",
        lastSyncHash: hash,
      },
    });

    // Step 8: Log
    const result: SyncResult = {
      success: true,
      action: existingMapping ? "update" : "create",
      direction,
      wixContactId: wixContact.id,
      hubspotContactId,
    };
    await logSync(wixConnectionId, result, triggerSource);

    logger.info("Synced Wix → HubSpot", {
      wixContactId: wixContact.id,
      hubspotContactId,
      action: result.action,
    });

    return result;
  } catch (error) {
    const result: SyncResult = {
      success: false,
      action: "error",
      direction,
      wixContactId: wixContact.id,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    await logSync(wixConnectionId, result, triggerSource);
    logger.error("Sync Wix → HubSpot failed", {
      wixContactId: wixContact.id,
      error: result.error,
    });
    return result;
  }
}

// ─── HubSpot → Wix Sync ───

/* Syncs a HubSpot contact change to Wix. Same 8-step flow as syncWixToHubSpot but reversed: fetches full HubSpot contact, maps to Wix format, handles conflict/dedupe, creates or updates in Wix (with revision for optimistic concurrency). */
export async function syncHubSpotToWix(
  wixConnectionId: string,
  hubspotContactId: string,
  action: "create" | "update",
  triggerSource: TriggerSource
): Promise<SyncResult> {
  const direction = "hubspot_to_wix" as const;

  try {
    await cleanupExpired();

    // Step 1: Dedupe check
    const dedupeKey = `hubspot:${hubspotContactId}`;
    if (await isDuplicate(dedupeKey)) {
      const result: SyncResult = {
        success: true,
        action: "skip",
        direction,
        hubspotContactId,
      };
      await logSync(wixConnectionId, result, triggerSource, { reason: "dedupe_hit" });
      return result;
    }

    // Load field mappings
    const mappings = await getFieldMappings(wixConnectionId);
    if (mappings.length === 0) {
      const result: SyncResult = {
        success: true,
        action: "skip",
        direction,
        hubspotContactId,
      };
      await logSync(wixConnectionId, result, triggerSource, { reason: "no_mappings" });
      return result;
    }

    // Fetch full HubSpot contact with all mapped properties
    const hsToken = await getValidHubSpotToken(wixConnectionId);
    const hsClient = createHubSpotClient(hsToken);
    const hubspotProperties = getMappedHubSpotProperties(mappings);
    const hsContact = await getHubSpotContact(hsClient, hubspotContactId, hubspotProperties);

    // Step 2: Map fields
    const mappedInfo = mapHubSpotToWix(hsContact.properties, mappings);

    // Step 3: Hash check
    const hashSource: Record<string, string> = {};
    for (const m of mappings) {
      if (m.direction === "hubspot_to_wix" || m.direction === "bidirectional") {
        const val = hsContact.properties[m.hubspotProperty];
        if (val) hashSource[m.hubspotProperty] = val;
      }
    }
    const hash = computeContactHash(hashSource);

    const existingMapping = await prisma.contactMapping.findUnique({
      where: {
        wixConnectionId_hubspotContactId: {
          wixConnectionId,
          hubspotContactId,
        },
      },
    });

    // Step 4: Conflict resolution
    const incomingTimestamp = new Date(hsContact.updatedAt);
    const decision = resolveConflict(incomingTimestamp, existingMapping, hash);

    if (decision === "skip") {
      const result: SyncResult = {
        success: true,
        action: "skip",
        direction,
        hubspotContactId,
        wixContactId: existingMapping?.wixContactId,
      };
      await logSync(wixConnectionId, result, triggerSource, { reason: "conflict_skip" });
      return result;
    }

    // Step 5: Get Wix client and create/update
    const wixConnection = await prisma.wixConnection.findUniqueOrThrow({
      where: { id: wixConnectionId },
    });

    // Skip Wix write if no real token (demo mode)
    if (wixConnection.accessToken === "pending") {
      const result: SyncResult = {
        success: true,
        action: "skip",
        direction,
        hubspotContactId,
      };
      await logSync(wixConnectionId, result, triggerSource, { reason: "wix_token_pending" });
      return result;
    }

    const wixToken = decrypt(wixConnection.accessToken);
    const wixClient = createWixClient(wixToken);

    let wixContactId: string;

    if (existingMapping) {
      // Must fetch current revision for optimistic concurrency
      const currentContact = await getWixContact(wixClient, existingMapping.wixContactId);
      await updateWixContact(
        wixClient,
        existingMapping.wixContactId,
        mappedInfo,
        currentContact.revision
      );
      wixContactId = existingMapping.wixContactId;
    } else {
      // Search by email first
      const email = hsContact.properties.email;
      let existingWixContact = email
        ? await findWixContactByEmail(wixClient, email)
        : null;

      if (existingWixContact) {
        await updateWixContact(
          wixClient,
          existingWixContact.id,
          mappedInfo,
          existingWixContact.revision
        );
        wixContactId = existingWixContact.id;
      } else {
        const newContact = await createWixContact(wixClient, mappedInfo);
        wixContactId = newContact.id;
      }
    }

    // Step 6: Mark dedupe
    await markAsSynced(`wix:${wixContactId}`, "hubspot", hash);

    // Step 7: Update mapping
    await prisma.contactMapping.upsert({
      where: {
        wixConnectionId_hubspotContactId: {
          wixConnectionId,
          hubspotContactId,
        },
      },
      create: {
        wixConnectionId,
        wixContactId,
        hubspotContactId,
        lastSyncedAt: new Date(),
        lastSyncSource: "hubspot",
        lastSyncHash: hash,
      },
      update: {
        wixContactId,
        lastSyncedAt: new Date(),
        lastSyncSource: "hubspot",
        lastSyncHash: hash,
      },
    });

    // Step 8: Log
    const result: SyncResult = {
      success: true,
      action: existingMapping ? "update" : "create",
      direction,
      wixContactId,
      hubspotContactId,
    };
    await logSync(wixConnectionId, result, triggerSource);

    logger.info("Synced HubSpot → Wix", {
      hubspotContactId,
      wixContactId,
      action: result.action,
    });

    return result;
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: unknown; status?: number } };
    const errorDetail = axiosError?.response?.data
      ? JSON.stringify(axiosError.response.data).slice(0, 500)
      : (error instanceof Error ? error.message : "Unknown error");
    const result: SyncResult = {
      success: false,
      action: "error",
      direction,
      hubspotContactId,
      error: errorDetail,
    };
    await logSync(wixConnectionId, result, triggerSource);
    logger.error("Sync HubSpot → Wix failed", {
      hubspotContactId,
      error: errorDetail,
    });
    return result;
  }
}
