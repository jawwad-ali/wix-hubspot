"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWixInstance } from "@/hooks/use-wix-instance";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { Copy, ExternalLink, Trash2, RefreshCw } from "lucide-react";

interface HubSpotStatus {
  connected: boolean;
  portalId?: string;
  connectedAt?: string;
}

export default function SettingsPage() {
  const { instanceId } = useWixInstance();
  const { toast } = useToast();
  const [hubspot, setHubspot] = useState<HubSpotStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const appUrl = typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const webhookUrls = {
    wix: `${appUrl}/api/webhooks/wix`,
    hubspot: `${appUrl}/api/webhooks/hubspot`,
  };

  useEffect(() => {
    if (!instanceId) return;

    fetch(`/api/auth/hubspot-status?instanceId=${instanceId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setHubspot(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [instanceId]);

  const handleConnect = async () => {
    if (!instanceId) return;
    const res = await fetch(`/api/auth/hubspot?instanceId=${instanceId}`);
    const data = await res.json();
    if (data.success) {
      window.open(data.data.authUrl, "_blank");
    }
  };

  const handleDisconnect = async () => {
    if (!instanceId || !confirm("Are you sure? This will stop all syncing.")) return;

    try {
      await fetch("/api/auth/hubspot/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId }),
      });
      setHubspot({ connected: false });
      toast("HubSpot disconnected", "info");
    } catch {
      toast("Failed to disconnect", "error");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Copied to clipboard", "success");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage your HubSpot connection and webhook configuration
        </p>
      </div>

      {/* HubSpot Connection */}
      <Card>
        <CardHeader>
          <CardTitle>HubSpot Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hubspot?.connected ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Connected to portal <strong>{hubspot.portalId}</strong>
                  </p>
                  {hubspot.connectedAt && (
                    <p className="text-xs text-gray-500">
                      Since {new Date(hubspot.connectedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Badge variant="success">Active</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={handleConnect}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Reconnect
                </Button>
                <Button variant="danger" size="sm" onClick={handleDisconnect}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">
                Connect your HubSpot account to start syncing contacts
              </p>
              <Button onClick={handleConnect}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Connect HubSpot
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook URLs */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Configure these URLs in your Wix and HubSpot developer portals to enable real-time sync.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wix Webhook URL
            </label>
            <div className="flex gap-2">
              <Input value={webhookUrls.wix} readOnly className="font-mono text-xs" />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyToClipboard(webhookUrls.wix)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              HubSpot Webhook URL
            </label>
            <div className="flex gap-2">
              <Input value={webhookUrls.hubspot} readOnly className="font-mono text-xs" />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyToClipboard(webhookUrls.hubspot)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
            <strong>Setup steps:</strong>
            <ol className="list-decimal ml-4 mt-1 space-y-1">
              <li>In Wix Dev Center → Webhooks → Add the Wix URL for contact.created and contact.updated events</li>
              <li>In HubSpot Developer Portal → App Settings → Webhooks → Add the HubSpot URL for contact.creation and contact.propertyChange subscriptions</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Instance Info */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Instance ID</span>
              <span className="font-mono text-xs text-gray-700">{instanceId}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
