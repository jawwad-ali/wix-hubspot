import { NextResponse } from "next/server";
import { WixFieldOption } from "@/types";

/**
 * GET /api/fields/wix
 * Returns the static list of known Wix contact fields with human-readable labels.
 * These are the dot-paths used in the field mapping system.
 */

const WIX_CONTACT_FIELDS: WixFieldOption[] = [
  // Name
  { value: "info.name.first", label: "First Name", group: "Name" },
  { value: "info.name.last", label: "Last Name", group: "Name" },

  // Email
  { value: "info.emails.0.email", label: "Primary Email", group: "Contact" },

  // Phone
  { value: "info.phones.0.phone", label: "Primary Phone", group: "Contact" },

  // Company
  { value: "info.company", label: "Company", group: "Work" },
  { value: "info.jobTitle", label: "Job Title", group: "Work" },

  // Address
  { value: "info.addresses.0.street", label: "Street Address", group: "Address" },
  { value: "info.addresses.0.city", label: "City", group: "Address" },
  { value: "info.addresses.0.region", label: "State/Region", group: "Address" },
  { value: "info.addresses.0.country", label: "Country", group: "Address" },
  { value: "info.addresses.0.postalCode", label: "Postal Code", group: "Address" },

  // Other
  { value: "info.birthdate", label: "Birthdate", group: "Other" },
  { value: "info.locale", label: "Locale", group: "Other" },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    data: WIX_CONTACT_FIELDS,
  });
}
