"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWixInstance } from "@/hooks/use-wix-instance";
import { ArrowRight, ArrowLeft } from "lucide-react";

interface SyncLogEntry {
  id: string;
  direction: string;
  action: string;
  wixContactId?: string;
  hubspotContactId?: string;
  triggerSource: string;
  createdAt: string;
  errorMessage?: string;
}

export function RecentActivity() {
  const { instanceId } = useWixInstance();
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);

  useEffect(() => {
    if (!instanceId) return;

    fetch(`/api/sync/status?instanceId=${instanceId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data.recentActivity) {
          setLogs(res.data.recentActivity);
        }
      })
      .catch(() => {});
  }, [instanceId]);

  const actionBadgeVariant = (action: string) => {
    switch (action) {
      case "create": return "success";
      case "update": return "info";
      case "skip": return "warning";
      case "error": return "error";
      default: return "default";
    }
  };

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 text-center py-8">
            No sync activity yet. Connect HubSpot and create a contact to see activity here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
              <th className="px-6 py-3">Time</th>
              <th className="px-6 py-3">Direction</th>
              <th className="px-6 py-3">Action</th>
              <th className="px-6 py-3">Contact</th>
              <th className="px-6 py-3">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.map((log) => (
              <tr key={log.id} className="text-sm">
                <td className="px-6 py-3 text-gray-500">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-1 text-gray-700">
                    {log.direction === "wix_to_hubspot" ? (
                      <>
                        <span className="text-xs font-medium">Wix</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="text-xs font-medium">HS</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-medium">HS</span>
                        <ArrowLeft className="h-3 w-3" />
                        <span className="text-xs font-medium">Wix</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3">
                  <Badge variant={actionBadgeVariant(log.action)}>
                    {log.action}
                  </Badge>
                </td>
                <td className="px-6 py-3 text-gray-600 font-mono text-xs">
                  {log.wixContactId?.slice(0, 8) || log.hubspotContactId?.slice(0, 8) || "—"}
                </td>
                <td className="px-6 py-3">
                  <span className="text-xs text-gray-500">{log.triggerSource}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
