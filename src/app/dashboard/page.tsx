"use client";

import { useState } from "react";
import { ConnectionStatus } from "@/components/dashboard/connection-status";
import { SyncStats } from "@/components/dashboard/sync-stats";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useWixInstance } from "@/hooks/use-wix-instance";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { RefreshCw } from "lucide-react";

export default function DashboardPage() {
  const { instanceId, isLoading } = useWixInstance();
  const { toast } = useToast();
  const [syncDirection, setSyncDirection] = useState("both");
  const [syncing, setSyncing] = useState(false);

  const handleManualSync = async () => {
    if (!instanceId) return;
    setSyncing(true);

    try {
      const res = await fetch("/api/sync/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId, direction: syncDirection }),
      });

      const data = await res.json();
      if (data.success) {
        toast("Sync completed successfully!", "success");
      } else {
        toast(data.error || "Sync failed", "error");
      }
    } catch {
      toast("Sync failed — check your connection", "error");
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">
          Monitor your Wix-HubSpot contact sync
        </p>
      </div>

      <ConnectionStatus />
      <SyncStats />

      <div className="flex items-center gap-3">
        <Select
          value={syncDirection}
          onChange={(e) => setSyncDirection(e.target.value)}
          className="w-52"
        >
          <option value="both">Sync Both Directions</option>
          <option value="wix_to_hubspot">Wix → HubSpot</option>
          <option value="hubspot_to_wix">HubSpot → Wix</option>
        </Select>
        <Button onClick={handleManualSync} disabled={syncing}>
          {syncing ? (
            <Spinner size="sm" className="mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {syncing ? "Syncing..." : "Manual Sync"}
        </Button>
      </div>

      <RecentActivity />
    </div>
  );
}
