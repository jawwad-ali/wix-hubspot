"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useWixInstance } from "@/hooks/use-wix-instance";
import { Users, Clock, CheckCircle, AlertCircle } from "lucide-react";

interface Stats {
  totalContactsSynced: number;
  lastSyncTime: string | null;
  successfulSyncs24h: number;
  errors24h: number;
}

export function SyncStats() {
  const { instanceId } = useWixInstance();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!instanceId) return;

    fetch(`/api/sync/status?instanceId=${instanceId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setStats(res.data);
      })
      .catch(() => {});
  }, [instanceId]);

  const items = [
    {
      label: "Contacts Synced",
      value: stats?.totalContactsSynced ?? 0,
      icon: Users,
      color: "text-blue-600 bg-blue-100",
    },
    {
      label: "Last Sync",
      value: stats?.lastSyncTime
        ? new Date(stats.lastSyncTime).toLocaleString()
        : "Never",
      icon: Clock,
      color: "text-purple-600 bg-purple-100",
    },
    {
      label: "Syncs (24h)",
      value: stats?.successfulSyncs24h ?? 0,
      icon: CheckCircle,
      color: "text-green-600 bg-green-100",
    },
    {
      label: "Errors (24h)",
      value: stats?.errors24h ?? 0,
      icon: AlertCircle,
      color: stats?.errors24h ? "text-red-600 bg-red-100" : "text-gray-600 bg-gray-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
                </p>
                <p className="text-xs text-gray-500">{item.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
