import axios from "axios";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";

const HUBSPOT_OAUTH_BASE = "https://api.hubapi.com/oauth/v1";

/* Constructs the HubSpot OAuth authorization URL. The state parameter carries the encrypted Wix instanceId to link the HubSpot connection back to the correct Wix site. */
export function getHubSpotAuthUrl(wixInstanceId: string): string {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const scopes = process.env.HUBSPOT_SCOPES || "crm.objects.contacts.read crm.objects.contacts.write";
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/hubspot/callback`;

  if (!clientId) throw new Error("HUBSPOT_CLIENT_ID is not configured");

  // Encrypt the instanceId as the state parameter (prevents CSRF + carries context)
  const state = encrypt(wixInstanceId);

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });

  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}

/* Exchanges an authorization code for access + refresh tokens. HubSpot requires application/x-www-form-urlencoded content type. */
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/hubspot/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET must be configured");
  }

  const response = await axios.post(
    `${HUBSPOT_OAUTH_BASE}/token`,
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }).toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  logger.info("HubSpot token exchange successful");

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresIn: response.data.expires_in, // 1800 seconds (30 min)
  };
}

/* Uses the refresh token to obtain a new access token. HubSpot does NOT return a new refresh token -- the original persists forever. */
export async function refreshAccessToken(encryptedRefreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET must be configured");
  }

  const refreshToken = decrypt(encryptedRefreshToken);

  const response = await axios.post(
    `${HUBSPOT_OAUTH_BASE}/token`,
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }).toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  logger.info("HubSpot token refresh successful");

  return {
    accessToken: response.data.access_token,
    expiresIn: response.data.expires_in,
  };
}

/* Retrieves the HubSpot portal ID from an access token. */
export async function getPortalId(accessToken: string): Promise<string> {
  const response = await axios.get(
    `${HUBSPOT_OAUTH_BASE}/access-tokens/${accessToken}`
  );
  return response.data.hub_id.toString();
}

/* Gets a valid (non-expired) HubSpot access token for a Wix connection. Automatically refreshes if the token is within 5 minutes of expiry. */
export async function getValidHubSpotToken(wixConnectionId: string): Promise<string> {
  const connection = await prisma.hubSpotConnection.findUnique({
    where: { wixConnectionId },
  });

  if (!connection) {
    throw new Error("HubSpot is not connected for this Wix site");
  }

  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  // If token is still valid (more than 5 min remaining), decrypt and return
  if (connection.tokenExpiresAt > fiveMinutesFromNow) {
    return decrypt(connection.accessToken);
  }

  // Token expired or expiring soon — refresh it
  logger.info("HubSpot token expired, refreshing", { wixConnectionId });

  const { accessToken, expiresIn } = await refreshAccessToken(connection.refreshToken);
  const encryptedToken = encrypt(accessToken);
  const newExpiry = new Date(Date.now() + expiresIn * 1000);

  await prisma.hubSpotConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encryptedToken,
      tokenExpiresAt: newExpiry,
    },
  });

  return accessToken;
}
