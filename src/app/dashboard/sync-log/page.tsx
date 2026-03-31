"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useWixInstance } from "@/hooks/use-wix-instance";
import { ArrowRight, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

interface SyncLogEntry {
  id: string;
  direction: string;
  action: string;
  wixContactId?: string;
  hubspotContactId?: string;
  triggerSource: string;
  details?: string;
  errorMessage?: string;
  createdAt: string;
}

export default function SyncLogPage() {
  const { instanceId } = useWixInstance();
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const loadLogs = useCallback(async () => {
    if (!instanceId) return;

    try {
      const res = await fetch(
        `/api/sync/logs?instanceId=${instanceId}&page=${page}&limit=${pageSize}`
      );
      const data = await res.json();
      if (data.success) {
        setLogs(data.data || []);
      }
    } catch {
      // Fallback to status endpoint for recent logs
      const res = await fetch(`/api/sync/status?instanceId=${instanceId}`);
      const data = await res.json();
      if (data.success && data.data.recentActivity) {
        setLogs(data.data.recentActivity);
      }
    } finally {
      setLoading(false);
    }
  }, [instanceId, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const actionBadgeVariant = (action: string) => {
    switch (action) {
      case "create": return "success" as const;
      case "update": return "info" as const;
      case "skip": return "warning" as const;
      case "error": return "error" as const;
      default: return "default" as const;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Sync Log</h2>
        <p className="text-sm text-gray-500 mt-1">
          History of all sync operations between Wix and HubSpot
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Direction</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Wix ID</th>
                <th className="px-6 py-3">HubSpot ID</th>
                <th className="px-6 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => (
                <>
                  <tr
                    key={log.id}
                    className="text-sm cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <td className="px-6 py-3 text-gray-500 text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1 text-gray-700">
                        {log.direction === "wix_to_hubspot" ? (
                          <>
                            <span className="text-xs">Wix</span>
                            <ArrowRight className="h-3 w-3" />
                            <span className="text-xs">HS</span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs">HS</span>
                            <ArrowLeft className="h-3 w-3" />
                            <span className="text-xs">Wix</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <Badge variant={actionBadgeVariant(log.action)}>
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-xs font-mono text-gray-600">
                      {log.wixContactId?.slice(0, 12) || "—"}
                    </td>
                    <td className="px-6 py-3 text-xs font-mono text-gray-600">
                      {log.hubspotContactId?.slice(0, 12) || "—"}
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500">
                      {log.triggerSource}
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr key={`${log.id}-detail`}>
                      <td colSpan={6} className="px-6 py-3 bg-gray-50">
                        <div className="text-xs space-y-1">
                          {log.errorMessage && (
                            <p className="text-red-600">
                              <strong>Error:</strong> {log.errorMessage}
                            </p>
                          )}
                          {log.details && (
                            <pre className="text-gray-600 overflow-auto max-h-32">
                              {JSON.stringify(JSON.parse(log.details), null, 2)}
                            </pre>
                          )}
                          {!log.errorMessage && !log.details && (
                            <p className="text-gray-400">No additional details</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                    No sync logs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <span className="text-sm text-gray-500">Page {page}</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPage(page + 1)}
          disabled={logs.length < pageSize}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
