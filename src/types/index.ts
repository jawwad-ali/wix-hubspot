// ─── Wix Types ───

export interface WixContactInfo {
  name?: { first?: string; last?: string };
  emails?: Array<{ tag?: string; email: string; primary?: boolean }>;
  phones?: Array<{ tag?: string; phone: string; primary?: boolean }>;
  addresses?: Array<{
    tag?: string;
    street?: string;
    city?: string;
    region?: string;
    country?: string;
    postalCode?: string;
  }>;
  company?: string;
  jobTitle?: string;
  birthdate?: string;
  locale?: string;
  labelKeys?: string[];
  extendedFields?: Record<string, unknown>;
}

export interface WixContact {
  id: string;
  revision: number;
  info: WixContactInfo;
  createdDate: string;
  updatedDate: string;
  lastActivity?: { activityDate: string; activityType: string };
  source?: { sourceType: string; appId?: string };
}

// ─── HubSpot Types ───

export interface HubSpotContactProperties {
  [key: string]: string;
}

export interface HubSpotContact {
  id: string;
  properties: HubSpotContactProperties;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  groupName: string;
  options?: Array<{ label: string; value: string }>;
  readOnlyValue: boolean;
  hidden: boolean;
  calculated: boolean;
}

export interface HubSpotWebhookEvent {
  objectId: number;
  propertyName?: string;
  propertyValue?: string;
  changeSource: string;
  eventId: number;
  subscriptionId: number;
  portalId: number;
  appId: number;
  occurredAt: number;
  subscriptionType: string;
  attemptNumber: number;
}

// ─── Sync Types ───

export type SyncDirection = "wix_to_hubspot" | "hubspot_to_wix" | "bidirectional";
export type SyncAction = "create" | "update" | "skip" | "error";
export type TriggerSource = "webhook" | "manual" | "form";
export type TransformType = "lowercase" | "uppercase" | "trim" | null;

export interface SyncResult {
  success: boolean;
  action: SyncAction;
  direction: "wix_to_hubspot" | "hubspot_to_wix";
  wixContactId?: string;
  hubspotContactId?: string;
  error?: string;
}

export interface SyncContext {
  wixConnectionId: string;
  wixToken: string;
  hubspotAccessToken: string;
  fieldMappings: Array<{
    wixField: string;
    hubspotProperty: string;
    direction: SyncDirection;
    transform: TransformType;
  }>;
}

// ─── Field Mapping UI Types ───

export interface WixFieldOption {
  value: string; // dot-path e.g. "info.name.first"
  label: string; // human-readable e.g. "First Name"
  group: string;
}

export interface HubSpotPropertyOption {
  value: string; // property name e.g. "firstname"
  label: string; // human-readable e.g. "First Name"
  group: string;
}

// ─── Form Types ───

export interface FormSubmissionData {
  instanceId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  customFields?: Record<string, string>;
  utm: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  pageUrl?: string;
  referrer?: string;
}

// ─── API Response Types ───

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
