import { WixContact, WixContactInfo, HubSpotContactProperties, TransformType } from "@/types";

interface MappingRule {
  wixField: string;
  hubspotProperty: string;
  direction: string;
  transform: TransformType;
}

/* Applies a transform to a string value. */
function applyTransform(value: string, transform: TransformType): string {
  if (!value || !transform) return value;
  switch (transform) {
    case "lowercase":
      return value.toLowerCase();
    case "uppercase":
      return value.toUpperCase();
    case "trim":
      return value.trim();
    default:
      return value;
  }
}

/* Extracts a value from a Wix contact using a dot-path. Supports simple paths, nested paths, and array paths. */
export function getValueFromWixContact(contact: WixContact, path: string): string | undefined {
  const parts = path.split(".");

  // Remove the leading "info." since we access contact.info
  if (parts[0] === "info") {
    parts.shift();
  }

  let current: unknown = contact.info;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    // Handle array index
    const arrayIndex = parseInt(part, 10);
    if (!isNaN(arrayIndex) && Array.isArray(current)) {
      current = current[arrayIndex];
    } else if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current !== null && current !== undefined ? String(current) : undefined;
}

/* Sets a value in a partial Wix contact info object using a dot-path. Builds the nested structure as needed. */
export function setValueInWixInfo(
  info: Partial<WixContactInfo>,
  path: string,
  value: string
): void {
  const parts = path.split(".");

  // Remove the leading "info."
  if (parts[0] === "info") {
    parts.shift();
  }

  let current: Record<string, unknown> = info as Record<string, unknown>;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const isNextArray = !isNaN(parseInt(nextPart, 10));

    if (current[part] === undefined || current[part] === null) {
      current[part] = isNextArray ? [] : {};
    }

    const arrayIndex = parseInt(part, 10);
    if (!isNaN(arrayIndex) && Array.isArray(current)) {
      // We're inside an array, ensure the element exists
      if (!current[arrayIndex]) {
        current[arrayIndex] = {} as unknown;
      }
      current = current[arrayIndex] as Record<string, unknown>;
    } else {
      current = current[part] as Record<string, unknown>;
    }
  }

  const lastPart = parts[parts.length - 1];
  const arrayIndex = parseInt(lastPart, 10);

  if (!isNaN(arrayIndex) && Array.isArray(current)) {
    current[arrayIndex] = value;
  } else {
    current[lastPart] = value;
  }
}

/* Maps Wix contact fields to HubSpot properties using the configured field mappings. Only includes mappings with direction wix_to_hubspot or bidirectional. */
export function mapWixToHubSpot(
  contact: WixContact,
  mappings: MappingRule[]
): HubSpotContactProperties {
  const result: HubSpotContactProperties = {};

  for (const mapping of mappings) {
    if (mapping.direction !== "wix_to_hubspot" && mapping.direction !== "bidirectional") {
      continue;
    }

    const value = getValueFromWixContact(contact, mapping.wixField);
    if (value !== undefined && value !== "") {
      result[mapping.hubspotProperty] = applyTransform(value, mapping.transform);
    }
  }

  return result;
}

/* Maps HubSpot properties to a partial Wix contact info object. Only includes mappings with direction hubspot_to_wix or bidirectional. */
export function mapHubSpotToWix(
  hubspotProperties: HubSpotContactProperties,
  mappings: MappingRule[]
): Partial<WixContactInfo> {
  const info: Partial<WixContactInfo> = {};

  for (const mapping of mappings) {
    if (mapping.direction !== "hubspot_to_wix" && mapping.direction !== "bidirectional") {
      continue;
    }

    const value = hubspotProperties[mapping.hubspotProperty];
    if (value !== undefined && value !== null && value !== "") {
      const transformed = applyTransform(value, mapping.transform);
      setValueInWixInfo(info, mapping.wixField, transformed);
    }
  }

  return info;
}

/* Extracts the mapped HubSpot property names from a set of mappings. Used to know which properties to request when fetching HubSpot contacts. */
export function getMappedHubSpotProperties(mappings: MappingRule[]): string[] {
  return [...new Set(mappings.map((m) => m.hubspotProperty))];
}
