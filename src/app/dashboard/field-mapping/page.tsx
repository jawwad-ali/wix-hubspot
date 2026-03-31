"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useWixInstance } from "@/hooks/use-wix-instance";
import { useToast } from "@/components/ui/toast";
import { Plus, Trash2, ArrowRight, ArrowLeft, ArrowLeftRight } from "lucide-react";

interface FieldMapping {
  id: string;
  wixField: string;
  hubspotProperty: string;
  direction: string;
  transform: string | null;
  isActive: boolean;
}

interface FieldOption {
  value: string;
  label: string;
  group: string;
}

export default function FieldMappingPage() {
  const { instanceId } = useWixInstance();
  const { toast } = useToast();
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [wixFields, setWixFields] = useState<FieldOption[]>([]);
  const [hubspotFields, setHubspotFields] = useState<FieldOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newMapping, setNewMapping] = useState({
    wixField: "",
    hubspotProperty: "",
    direction: "bidirectional",
    transform: "",
  });

  const loadData = useCallback(async () => {
    if (!instanceId) return;

    try {
      const [mappingsRes, wixRes, hubspotRes] = await Promise.all([
        fetch(`/api/field-mapping?instanceId=${instanceId}`),
        fetch("/api/fields/wix"),
        fetch(`/api/fields/hubspot?instanceId=${instanceId}`),
      ]);

      const [mappingsData, wixData, hubspotData] = await Promise.all([
        mappingsRes.json(),
        wixRes.json(),
        hubspotRes.json(),
      ]);

      if (mappingsData.success) setMappings(mappingsData.data);
      if (wixData.success) setWixFields(wixData.data);
      if (hubspotData.success) setHubspotFields(hubspotData.data);
    } catch {
      toast("Failed to load field mapping data", "error");
    } finally {
      setLoading(false);
    }
  }, [instanceId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = async () => {
    if (!newMapping.wixField || !newMapping.hubspotProperty) {
      toast("Please select both fields", "error");
      return;
    }

    try {
      const res = await fetch("/api/field-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId, ...newMapping, transform: newMapping.transform || null }),
      });

      const data = await res.json();
      if (data.success) {
        setMappings([...mappings, data.data]);
        setDialogOpen(false);
        setNewMapping({ wixField: "", hubspotProperty: "", direction: "bidirectional", transform: "" });
        toast("Mapping added", "success");
      } else {
        toast(data.error || "Failed to add mapping", "error");
      }
    } catch {
      toast("Failed to add mapping", "error");
    }
  };

  const handleUpdate = async (id: string, updates: Partial<FieldMapping>) => {
    try {
      const res = await fetch("/api/field-mapping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });

      const data = await res.json();
      if (data.success) {
        setMappings(mappings.map((m) => (m.id === id ? { ...m, ...updates } : m)));
        toast("Mapping updated", "success");
      }
    } catch {
      toast("Failed to update mapping", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch("/api/field-mapping", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();
      if (data.success) {
        setMappings(mappings.filter((m) => m.id !== id));
        toast("Mapping deleted", "success");
      }
    } catch {
      toast("Failed to delete mapping", "error");
    }
  };

  const getFieldLabel = (value: string, options: FieldOption[]) =>
    options.find((o) => o.value === value)?.label || value;

  const directionIcon = (dir: string) => {
    switch (dir) {
      case "wix_to_hubspot": return <ArrowRight className="h-4 w-4" />;
      case "hubspot_to_wix": return <ArrowLeft className="h-4 w-4" />;
      default: return <ArrowLeftRight className="h-4 w-4" />;
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Field Mapping</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure which Wix fields sync to which HubSpot properties
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Mapping
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                <th className="px-6 py-3">Wix Field</th>
                <th className="px-6 py-3">Direction</th>
                <th className="px-6 py-3">HubSpot Property</th>
                <th className="px-6 py-3">Transform</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mappings.map((mapping) => (
                <tr key={mapping.id} className="text-sm">
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {getFieldLabel(mapping.wixField, wixFields)}
                  </td>
                  <td className="px-6 py-3">
                    <Select
                      value={mapping.direction}
                      onChange={(e) => handleUpdate(mapping.id, { direction: e.target.value })}
                      className="w-40 text-xs"
                    >
                      <option value="bidirectional">Bi-directional</option>
                      <option value="wix_to_hubspot">Wix → HubSpot</option>
                      <option value="hubspot_to_wix">HubSpot → Wix</option>
                    </Select>
                  </td>
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {getFieldLabel(mapping.hubspotProperty, hubspotFields)}
                  </td>
                  <td className="px-6 py-3">
                    <Select
                      value={mapping.transform || ""}
                      onChange={(e) => handleUpdate(mapping.id, { transform: e.target.value || null } as Partial<FieldMapping>)}
                      className="w-28 text-xs"
                    >
                      <option value="">None</option>
                      <option value="lowercase">Lowercase</option>
                      <option value="uppercase">Uppercase</option>
                      <option value="trim">Trim</option>
                    </Select>
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => handleUpdate(mapping.id, { isActive: !mapping.isActive })}
                      className="cursor-pointer"
                    >
                      <Badge variant={mapping.isActive ? "success" : "default"}>
                        {mapping.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(mapping.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {mappings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                    No field mappings configured. Connect HubSpot first, then add mappings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Add Field Mapping"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wix Field
            </label>
            <Select
              value={newMapping.wixField}
              onChange={(e) => setNewMapping({ ...newMapping, wixField: e.target.value })}
            >
              <option value="">Select Wix field...</option>
              {wixFields.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label} ({f.group})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              HubSpot Property
            </label>
            <Select
              value={newMapping.hubspotProperty}
              onChange={(e) => setNewMapping({ ...newMapping, hubspotProperty: e.target.value })}
            >
              <option value="">Select HubSpot property...</option>
              {hubspotFields.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sync Direction
            </label>
            <Select
              value={newMapping.direction}
              onChange={(e) => setNewMapping({ ...newMapping, direction: e.target.value })}
            >
              <option value="bidirectional">Bi-directional</option>
              <option value="wix_to_hubspot">Wix → HubSpot only</option>
              <option value="hubspot_to_wix">HubSpot → Wix only</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transform (optional)
            </label>
            <Select
              value={newMapping.transform}
              onChange={(e) => setNewMapping({ ...newMapping, transform: e.target.value })}
            >
              <option value="">None</option>
              <option value="lowercase">Lowercase</option>
              <option value="uppercase">Uppercase</option>
              <option value="trim">Trim</option>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Add Mapping</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
