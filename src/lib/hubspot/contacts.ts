import { Client } from "@hubspot/api-client";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/contacts/models/Filter";
import { HubSpotContact, HubSpotContactProperties } from "@/types";
import { logger } from "@/lib/logger";

/**
 * Creates a HubSpot API client with the given access token.
 */
export function createHubSpotClient(accessToken: string): Client {
  return new Client({ accessToken });
}

/**
 * Get a single HubSpot contact by ID.
 * Pass specific property names to include in the response.
 */
export async function getHubSpotContact(
  client: Client,
  contactId: string,
  properties?: string[]
): Promise<HubSpotContact> {
  const response = await client.crm.contacts.basicApi.getById(
    contactId,
    properties
  );
  return {
    id: response.id,
    properties: response.properties as HubSpotContactProperties,
    createdAt: response.createdAt.toISOString(),
    updatedAt: response.updatedAt.toISOString(),
  };
}

/**
 * Create a new HubSpot contact.
 */
export async function createHubSpotContact(
  client: Client,
  properties: HubSpotContactProperties
): Promise<HubSpotContact> {
  const response = await client.crm.contacts.basicApi.create({
    properties,
    associations: [],
  });
  logger.info("HubSpot contact created", { contactId: response.id });
  return {
    id: response.id,
    properties: response.properties as HubSpotContactProperties,
    createdAt: response.createdAt.toISOString(),
    updatedAt: response.updatedAt.toISOString(),
  };
}

/**
 * Update a HubSpot contact by ID.
 */
export async function updateHubSpotContact(
  client: Client,
  contactId: string,
  properties: HubSpotContactProperties
): Promise<HubSpotContact> {
  const response = await client.crm.contacts.basicApi.update(contactId, {
    properties,
  });
  logger.info("HubSpot contact updated", { contactId });
  return {
    id: response.id,
    properties: response.properties as HubSpotContactProperties,
    createdAt: response.createdAt.toISOString(),
    updatedAt: response.updatedAt.toISOString(),
  };
}

/**
 * Search for a HubSpot contact by email.
 * Returns the first match or null.
 */
export async function searchHubSpotContactByEmail(
  client: Client,
  email: string
): Promise<HubSpotContact | null> {
  const response = await client.crm.contacts.searchApi.doSearch({
    filterGroups: [
      {
        filters: [
          {
            propertyName: "email",
            operator: FilterOperatorEnum.Eq,
            value: email,
          },
        ],
      },
    ],
    sorts: [],
    properties: [],
    limit: 1,
    after: "0",
  });

  if (response.results.length === 0) return null;

  const contact = response.results[0];
  return {
    id: contact.id,
    properties: contact.properties as HubSpotContactProperties,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

/**
 * List all HubSpot contacts.
 * Uses the SDK's built-in pagination handling.
 */
export async function listAllHubSpotContacts(
  client: Client,
  properties?: string[]
): Promise<HubSpotContact[]> {
  const allContacts = await client.crm.contacts.getAll(
    undefined, // limit handled internally
    undefined, // after
    properties
  );

  return allContacts.map((c) => ({
    id: c.id,
    properties: c.properties as HubSpotContactProperties,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
}
