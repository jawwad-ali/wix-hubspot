"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWixInstance } from "@/hooks/use-wix-instance";
import { Spinner } from "@/components/ui/spinner";
import { Link2, Unlink } from "lucide-react";

interface HubSpotStatus {
  connected: boolean;
  portalId?: string;
  connectedAt?: string;
  reason?: string;
}

export function ConnectionStatus() {
  const { instanceId } = useWixInstance();
  const [hubspot, setHubspot] = useState<HubSpotStatus | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (!instanceId) return;

    await fetch(`/api/auth/hubspot/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instanceId }),
    });
    setHubspot({ connected: false });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <span className="text-lg font-bold text-blue-600">W</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Wix</p>
              <p className="text-xs text-gray-500">Site Connection</p>
            </div>
          </div>
          <Badge variant="success">Connected</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <span className="text-lg font-bold text-orange-600">H</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">HubSpot</p>
              {hubspot?.connected ? (
                <p className="text-xs text-gray-500">Portal {hubspot.portalId}</p>
              ) : (
                <p className="text-xs text-gray-500">Not connected</p>
              )}
            </div>
          </div>
          {loading ? (
            <Spinner size="sm" />
          ) : hubspot?.connected ? (
            <div className="flex items-center gap-2">
              <Badge variant="success">Connected</Badge>
              <Button size="sm" variant="ghost" onClick={handleDisconnect}>
                <Unlink className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={handleConnect}>
              <Link2 className="h-4 w-4 mr-1" />
              Connect
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
