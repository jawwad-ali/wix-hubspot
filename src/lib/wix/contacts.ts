import { AxiosInstance } from "axios";
import { WixContact, WixContactInfo } from "@/types";
import { logger } from "@/lib/logger";

const CONTACTS_BASE = "/contacts/v4/contacts";

/**
 * Get a single Wix contact by ID.
 * Returns the full contact including the `revision` field needed for updates.
 */
export async function getWixContact(
  client: AxiosInstance,
  contactId: string
): Promise<WixContact> {
  const response = await client.get(`${CONTACTS_BASE}/${contactId}`);
  return response.data.contact;
}

/**
 * Create a new Wix contact.
 * Returns the created contact with its assigned ID.
 */
export async function createWixContact(
  client: AxiosInstance,
  info: WixContactInfo
): Promise<WixContact> {
  const response = await client.post(CONTACTS_BASE, { info });
  logger.info("Wix contact created", { contactId: response.data.contact.id });
  return response.data.contact;
}

/**
 * Update a Wix contact.
 * IMPORTANT: Requires the current `revision` number for optimistic concurrency.
 * You must GET the contact first to obtain the current revision.
 */
export async function updateWixContact(
  client: AxiosInstance,
  contactId: string,
  info: Partial<WixContactInfo>,
  revision: number
): Promise<WixContact> {
  const response = await client.patch(`${CONTACTS_BASE}/${contactId}`, {
    info,
    revision,
  });
  logger.info("Wix contact updated", { contactId });
  return response.data.contact;
}

/**
 * Query Wix contacts with optional filter and pagination.
 */
export async function queryWixContacts(
  client: AxiosInstance,
  filter?: Record<string, unknown>,
  paging?: { limit: number; offset: number }
): Promise<{ contacts: WixContact[]; totalCount: number }> {
  const response = await client.post(`${CONTACTS_BASE}/query`, {
    query: {
      filter: filter || {},
      paging: paging || { limit: 100, offset: 0 },
    },
  });
  return {
    contacts: response.data.contacts || [],
    totalCount: response.data.pagingMetadata?.total || 0,
  };
}

/**
 * Find a Wix contact by email address.
 * Returns the first match or null.
 */
export async function findWixContactByEmail(
  client: AxiosInstance,
  email: string
): Promise<WixContact | null> {
  const { contacts } = await queryWixContacts(client, {
    "info.emails.email": { $eq: email },
  });
  return contacts.length > 0 ? contacts[0] : null;
}

/**
 * List all Wix contacts with pagination support.
 * Used for full sync operations.
 */
export async function listAllWixContacts(
  client: AxiosInstance,
  batchSize: number = 100
): Promise<WixContact[]> {
  const allContacts: WixContact[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { contacts, totalCount } = await queryWixContacts(client, {}, {
      limit: batchSize,
      offset,
    });
    allContacts.push(...contacts);
    offset += batchSize;
    hasMore = offset < totalCount;
  }

  return allContacts;
}
