import { Client } from "@hubspot/api-client";
import { logger } from "@/lib/logger";

const UTM_PROPERTY_NAMES = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "form_page_url",
  "form_referrer",
];

/**
 * Checks which UTM properties exist in HubSpot by fetching all properties once.
 * Returns the set of UTM property names that are available.
 */
export async function ensureUtmProperties(client: Client): Promise<Set<string>> {
  const available = new Set<string>();

  try {
    // Fetch ALL contact properties in one call
    const response = await client.crm.properties.coreApi.getAll("contacts");
    const existingNames = new Set(response.results.map((p) => p.name));

    // Check which UTM properties exist
    for (const name of UTM_PROPERTY_NAMES) {
      if (existingNames.has(name)) {
        available.add(name);
      }
    }

    logger.info("UTM properties check", { available: available.size, total: UTM_PROPERTY_NAMES.length });
  } catch (error) {
    logger.error("Failed to check UTM properties", {
      error: error instanceof Error ? error.message : "Unknown",
    });
  }

  return available;
}
