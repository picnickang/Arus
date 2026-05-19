import { useState, useRef } from "react";
import { useQuery, useMutation, useQueries } from "@tanstack/react-query";
import { apiRequest, queryClient, createHeaders, resolveUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import type { Vessel } from "@shared/schema";

interface EquipmentPin {
  equipmentId: string;
  x: number;
  y: number;
  z: number;
  label?: string;
}

interface ModelMetadata {
  id: string;
  orgId: string;
  vesselId: string;
  filename: string;
  mimetype: string;
  sizeBytes: number;
  equipmentPins: EquipmentPin[];
  createdAt: string | null;
  updatedAt: string | null;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function Admin3DModelsPage() {
  const { toast } = useToast();

  const vesselsQuery = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  const vessels = vesselsQuery.data ?? [];

  const modelQueries = useQueries({
    queries: vessels.map((v) => ({
      queryKey: ["/api/v1/vessels", v.id, "3d-model"] as const,
      queryFn: async () => {
        const res = await fetch(
          resolveUrl(`/api/v1/vessels/${encodeURIComponent(v.id)}/3d-model`),
          { credentials: "include", headers: createHeaders() }
        );
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => res.statusText)}`);
        return (await res.json()) as ModelMetadata;
      },
    })),
  });

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-3d-models">
      <header>
        <h1 className="text-2xl font-bold">3D Vessel Models</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload self-contained <code>.glb</code> models and place equipment
          pins. Models stream to the 3D Digital Twin viewer at{" "}
          <code>/vessels/:id/3d</code>.
        </p>
      </header>

      {vesselsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading vessels…
        </div>
      ) : vessels.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No vessels found. Add a vessel before uploading a 3D model.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {vessels.map((vessel, idx) => {
            const mq = modelQueries[idx];
            return (
              <VesselModelCard
                key={vessel.id}
                vessel={vessel}
                model={mq?.data ?? null}
                loading={mq?.isLoading ?? false}
                error={mq?.error as Error | null}
                onChanged={() => {
                  queryClient.invalidateQueries({
                    queryKey: ["/api/v1/vessels", vessel.id, "3d-model"],
                  });
                  toast({ title: "3D model updated" });
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function VesselModelCard({
  vessel,
  model,
  loading,
  error,
  onChanged,
}: {
  vessel: Vessel;
  model: ModelMetadata | null;
  loading: boolean;
  error: Error | null;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("model", file);
      // Use shared header builder so x-org-id / session token travel with
      // the multipart upload; do NOT include Content-Type so the browser
      // sets the multipart boundary itself.
      const res = await fetch(
        resolveUrl(`/api/v1/vessels/${encodeURIComponent(vessel.id)}/3d-model`),
        {
          method: "POST",
          body: fd,
          credentials: "include",
          headers: createHeaders(),
        }
      );
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const body = await res.json();
          msg =
            typeof body?.error === "string"
              ? body.error
              : JSON.stringify(body?.error ?? body);
        } catch {
          /* ignore */
        }
        if (res.status === 403) {
          throw new Error("Admin role required to upload 3D models.");
        }
        throw new Error(msg);
      }
      onChanged();
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <Card data-testid={`card-vessel-model-${vessel.id}`}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3 text-base">
          <span>{vessel.name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {vessel.id}
          </span>
          {model ? (
            <Badge variant="secondary" data-testid={`badge-model-status-${vessel.id}`}>
              Model attached
            </Badge>
          ) : (
            <Badge variant="outline" data-testid={`badge-model-status-${vessel.id}`}>
              No model uploaded
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading model…
          </div>
        )}

        {error && !loading && (
          <div
            className="text-sm text-destructive"
            data-testid={`text-model-error-${vessel.id}`}
          >
            {error.message.includes("403") || /forbidden/i.test(error.message)
              ? "Admin role required to view this model."
              : `Failed to load model: ${error.message}`}
          </div>
        )}

        {!loading && model && (
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
            <div>
              <dt className="text-muted-foreground">File</dt>
              <dd className="font-mono">{model.filename}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Size</dt>
              <dd>{formatBytes(model.sizeBytes)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated</dt>
              <dd>
                {model.updatedAt
                  ? new Date(model.updatedAt).toLocaleString()
                  : "—"}
              </dd>
            </div>
          </dl>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor={`file-${vessel.id}`}>Upload .glb</Label>
            <Input
              id={`file-${vessel.id}`}
              ref={fileInput}
              type="file"
              accept=".glb,model/gltf-binary"
              data-testid={`input-model-file-${vessel.id}`}
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            Self-contained .glb only, max 100 MB. The server rejects spoofed
            extensions via magic-byte verification.
          </span>
          {uploading && (
            <span className="text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
            </span>
          )}
        </div>

        {model && (
          <PinEditor
            model={model}
            vesselId={vessel.id}
            onSaved={onChanged}
          />
        )}
      </CardContent>
    </Card>
  );
}

function PinEditor({
  model,
  vesselId,
  onSaved,
}: {
  model: ModelMetadata;
  vesselId: string;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [pins, setPins] = useState<EquipmentPin[]>(model.equipmentPins ?? []);
  const [dirty, setDirty] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      // Coerce numeric strings to numbers and drop empty equipmentId rows
      // before sending — the server rejects malformed pins with 400.
      const clean = pins
        .map((p) => ({
          equipmentId: p.equipmentId.trim(),
          x: Number(p.x),
          y: Number(p.y),
          z: Number(p.z),
          label: p.label?.trim() || undefined,
        }))
        .filter((p) => p.equipmentId.length > 0);
      return apiRequest(
        "PATCH",
        `/api/v1/vessels/3d-model/${encodeURIComponent(model.id)}/pins`,
        { pins: clean }
      );
    },
    onSuccess: () => {
      toast({ title: "Pins saved" });
      setDirty(false);
      onSaved();
    },
    onError: (e: any) => {
      const raw = typeof e?.message === "string" ? e.message : JSON.stringify(e?.message ?? e);
      const friendly = /^403:/.test(raw) || /forbidden/i.test(raw)
        ? "Admin role required to edit equipment pins."
        : raw;
      toast({
        title: "Save failed",
        description: friendly,
        variant: "destructive",
      });
    },
  });

  const updatePin = (i: number, patch: Partial<EquipmentPin>) => {
    setPins((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p))
    );
    setDirty(true);
  };

  const addPin = () => {
    setPins((prev) => [...prev, { equipmentId: "", x: 0, y: 0, z: 0 }]);
    setDirty(true);
  };

  const removePin = (i: number) => {
    setPins((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  return (
    <div
      className="border-t pt-4 space-y-3"
      data-testid={`pin-editor-${vesselId}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Equipment Pins ({pins.length})</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={addPin}
            data-testid={`button-add-pin-${vesselId}`}
          >
            <Plus className="h-4 w-4 mr-1" /> Add pin
          </Button>
          <Button
            size="sm"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
            data-testid={`button-save-pins-${vesselId}`}
          >
            {save.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1" /> Save pins
              </>
            )}
          </Button>
        </div>
      </div>

      {pins.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pins yet. Add a pin to mark an equipment location on the model.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipment ID</TableHead>
              <TableHead className="w-24">X</TableHead>
              <TableHead className="w-24">Y</TableHead>
              <TableHead className="w-24">Z</TableHead>
              <TableHead>Label (optional)</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pins.map((p, i) => (
              <TableRow key={i} data-testid={`row-pin-${vesselId}-${i}`}>
                <TableCell>
                  <Input
                    value={p.equipmentId}
                    onChange={(e) => updatePin(i, { equipmentId: e.target.value })}
                    placeholder="eq_…"
                    data-testid={`input-pin-equipment-${vesselId}-${i}`}
                  />
                </TableCell>
                {(["x", "y", "z"] as const).map((axis) => (
                  <TableCell key={axis}>
                    <Input
                      type="number"
                      step="0.01"
                      value={p[axis]}
                      onChange={(e) =>
                        updatePin(i, { [axis]: Number(e.target.value) } as Partial<EquipmentPin>)
                      }
                      data-testid={`input-pin-${axis}-${vesselId}-${i}`}
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <Input
                    value={p.label ?? ""}
                    onChange={(e) => updatePin(i, { label: e.target.value })}
                    placeholder="(optional)"
                    data-testid={`input-pin-label-${vesselId}-${i}`}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removePin(i)}
                    data-testid={`button-remove-pin-${vesselId}-${i}`}
                    aria-label="Remove pin"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
