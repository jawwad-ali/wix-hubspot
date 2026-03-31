import { Client } from "@hubspot/api-client";
import { logger } from "@/lib/logger";

const UTM_PROPERTIES = [
  { name: "utm_source", label: "UTM Source", groupName: "contactinformation" },
  { name: "utm_medium", label: "UTM Medium", groupName: "contactinformation" },
  { name: "utm_campaign", label: "UTM Campaign", groupName: "contactinformation" },
  { name: "utm_term", label: "UTM Term", groupName: "contactinformation" },
  { name: "utm_content", label: "UTM Content", groupName: "contactinformation" },
  { name: "form_page_url", label: "Form Page URL", groupName: "contactinformation" },
  { name: "form_referrer", label: "Form Referrer", groupName: "contactinformation" },
];

/**
 * Ensures UTM custom properties exist in HubSpot.
 * Creates them if they don't exist, silently skips if they do.
 * Returns the list of property names that are available.
 */
export async function ensureUtmProperties(client: Client): Promise<Set<string>> {
  const available = new Set<string>();

  for (const prop of UTM_PROPERTIES) {
    try {
      // Check if property exists
      await client.crm.properties.coreApi.getByName("contacts", prop.name);
      available.add(prop.name);
    } catch {
      // Property doesn't exist — create it
      try {
        await client.crm.properties.coreApi.create("contacts", {
          name: prop.name,
          label: prop.label,
          type: "string",
          fieldType: "text",
          groupName: prop.groupName,
        });
        available.add(prop.name);
        logger.info("Created HubSpot UTM property", { name: prop.name });
      } catch (createError) {
        logger.warn("Could not create HubSpot property", {
          name: prop.name,
          error: createError instanceof Error ? createError.message : "Unknown",
        });
      }
    }
  }

  return available;
}
