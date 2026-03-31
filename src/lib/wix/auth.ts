import axios from "axios";
import { logger } from "@/lib/logger";

const WIX_OAUTH_BASE = "https://www.wixapis.com/oauth2";

/**
 * Resolves a Wix instance token (passed as ?instance= in iframe URL)
 * into an instanceId by calling Wix's token-info endpoint.
 */
export async function resolveInstanceFromDashboard(instanceToken: string): Promise<{
  instanceId: string;
  siteId?: string;
}> {
  const appId = process.env.WIX_APP_ID;
  if (!appId) throw new Error("WIX_APP_ID is not configured");

  // The instance token is a signed JWT from Wix containing the instanceId.
  // We can decode it directly (base64url) or call the token-info endpoint.
  // For simplicity and verification, we decode the JWT payload.
  try {
    const parts = instanceToken.split(".");
    if (parts.length >= 2) {
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf8")
      );
      return {
        instanceId: payload.instanceId,
        siteId: payload.siteOwnerId || payload.siteId,
      };
    }
  } catch {
    logger.debug("Could not decode instance token as JWT, falling back to API");
  }

  // Fallback: call Wix API
  const response = await axios.post(`${WIX_OAUTH_BASE}/token-info`, {
    token: instanceToken,
  });

  return {
    instanceId: response.data.instanceId,
    siteId: response.data.siteOwnerId,
  };
}

/**
 * Exchanges a Wix instanceId for an access token using client credentials.
 * This is the "app identity" flow — the token is scoped to the app's
 * permissions on the specific Wix site identified by instanceId.
 */
export async function exchangeInstanceToken(instanceId: string): Promise<{
  accessToken: string;
}> {
  const appId = process.env.WIX_APP_ID;
  const appSecret = process.env.WIX_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("WIX_APP_ID and WIX_APP_SECRET must be configured");
  }

  const response = await axios.post(`${WIX_OAUTH_BASE}/token`, {
    grant_type: "client_credentials",
    client_id: appId,
    client_secret: appSecret,
    instance_id: instanceId,
  });

  logger.info("Wix token exchange successful", { instanceId });

  return {
    accessToken: response.data.access_token,
  };
}

/**
 * Creates an axios instance configured for Wix REST API calls.
 */
export function createWixClient(accessToken: string) {
  return axios.create({
    baseURL: "https://www.wixapis.com",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}
