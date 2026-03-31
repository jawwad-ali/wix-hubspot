import { Client } from "@hubspot/api-client";
import { HubSpotProperty } from "@/types";

/**
 * Lists all contact properties from HubSpot.
 * Filters out read-only, hidden, and calculated properties that users shouldn't map to.
 * Also filters out internal HubSpot properties (hs_ prefix) unless they're commonly used.
 */
export async function getContactProperties(
  client: Client
): Promise<HubSpotProperty[]> {
  const response = await client.crm.properties.coreApi.getAll("contacts");

  return response.results
    .map((p) => ({
      name: p.name,
      label: p.label,
      type: p.type,
      fieldType: p.fieldType,
      groupName: p.groupName,
      options: p.options?.map((o) => ({ label: o.label, value: o.value })),
      readOnlyValue: p.modificationMetadata?.readOnlyValue ?? false,
      hidden: p.hidden ?? false,
      calculated: p.calculated ?? false,
    }))
    .filter((p) => {
      // Allow commonly used HubSpot properties
      const allowedHsProps = [
        "hs_lead_status",
        "hs_lifecyclestage_lead_date",
      ];
      if (allowedHsProps.includes(p.name)) return true;

      // Filter out read-only and calculated properties
      if (p.readOnlyValue || p.calculated) return false;

      // Filter out hidden properties
      if (p.hidden) return false;

      // Filter out most internal HubSpot properties
      if (p.name.startsWith("hs_") && !allowedHsProps.includes(p.name)) return false;

      return true;
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
