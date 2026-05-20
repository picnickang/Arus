import { useState, useRef, useMemo, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueries } from "@tanstack/react-query";
import { apiRequest, queryClient, createHeaders, resolveUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Crosshair, Loader2, Plus, Trash2, Upload } from "lucide-react";
import type { Equipment, Vessel } from "@shared/schema";

// Lazy so the admin page doesn't pull Three.js into the system-hub
// bundle for non-admins who never reach the 3D editor.
const Vessel3DTwin = lazy(() => import("@/components/vessel/Vessel3DTwin"));

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

  // Page-level admin gate. The backend role check sits on the mutating
  // routes, but if a non-admin opens this page we want a clear "Admin
  // only" empty state rather than letting them poke around an empty UI.
  const vesselsErr = vesselsQuery.error as Error | null;
  const isForbidden =
    !!vesselsErr && (/^403:/.test(vesselsErr.message) || /forbidden/i.test(vesselsErr.message));

  if (isForbidden) {
    return (
      <div className="p-6" data-testid="page-admin-3d-models-forbidden">
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <h1 className="text-lg font-semibold">Admin only</h1>
            <p className="text-sm text-muted-foreground">
              You need the admin or chief engineer role to manage 3D vessel
              models and equipment pins.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
    } catch (err: unknown) {
      const description = err instanceof Error ? err.message : String(err);
      toast({
        title: "Upload failed",
        description,
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

/**
 * #112 — Placement arming state. The admin clicks "Place" on a row
 * (or "Add pin via 3D click") to arm placement; the next click on the
 * 3D model writes that pin's coordinates and disarms. `mode === "add"`
 * appends a new pin once placed; `mode === "move"` updates the
 * existing row at `targetIdx`.
 */
type PlacementArm =
  | { mode: "add" }
  | { mode: "move"; targetIdx: number }
  | null;

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
  const [placement, setPlacement] = useState<PlacementArm>(null);

  // Vessel-scoped equipment list for the picker — admins shouldn't have
  // to memorize equipment IDs. Falls back to a free-text input below if
  // the list is empty or the request fails.
  // Default fetcher (`getQueryFn` in queryClient.ts) serializes the
  // second array element as URL params, so this hits
  // `/api/equipment?vesselId=…` without a custom queryFn — keeps the
  // cache key aligned with the rest of the app.
  const equipmentQuery = useQuery<Equipment[]>({
    queryKey: ["/api/equipment", { vesselId }],
  });
  const equipmentList = equipmentQuery.data ?? [];
  const equipmentById = useMemo(() => {
    const map = new Map<string, Equipment>();
    for (const e of equipmentList) map.set(e.id, e);
    return map;
  }, [equipmentList]);

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
    onError: (e: unknown) => {
      const raw = e instanceof Error ? e.message : JSON.stringify(e);
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
    // If the removed row was the placement target, disarm.
    setPlacement((arm) =>
      arm?.mode === "move" && arm.targetIdx === i ? null : arm
    );
  };

  /** Arm "Add via 3D click" mode; the next model click creates a pin. */
  const armAddViaClick = () => {
    setPlacement({ mode: "add" });
  };

  /** Arm "Move via 3D click" for an existing row. */
  const armMoveViaClick = (idx: number) => {
    setPlacement({ mode: "move", targetIdx: idx });
  };

  /** Disarm without placing (e.g. user clicked away). */
  const disarmPlacement = () => setPlacement(null);

  /** Fires when the admin clicks a point on the model in placement mode. */
  const handlePlaceAt = (point: { x: number; y: number; z: number }) => {
    if (!placement) return;
    // Round to 0.001 — pin precision below mm-of-mesh is noise and
    // makes the table easier to read.
    const round = (n: number) => Math.round(n * 1000) / 1000;
    const next = { x: round(point.x), y: round(point.y), z: round(point.z) };
    if (placement.mode === "add") {
      setPins((prev) => [...prev, { equipmentId: "", ...next }]);
      setDirty(true);
      // After adding, arm "move" on the new row so the admin can
      // immediately re-place it if the first hit was off.
      setPlacement(null);
    } else {
      setPins((prev) =>
        prev.map((p, idx) =>
          idx === placement.targetIdx ? { ...p, ...next } : p
        )
      );
      setDirty(true);
      setPlacement(null);
    }
  };

  const placementHint = placement
    ? placement.mode === "add"
      ? "Click on the 3D model to drop a new pin at that point."
      : `Click on the 3D model to move pin #${placement.targetIdx + 1}.`
    : null;

  return (
    <div
      className="border-t pt-4 space-y-3"
      data-testid={`pin-editor-${vesselId}`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-medium">Equipment Pins ({pins.length})</h3>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={addPin}
            data-testid={`button-add-pin-${vesselId}`}
          >
            <Plus className="h-4 w-4 mr-1" /> Add empty row
          </Button>
          <Button
            size="sm"
            variant={placement?.mode === "add" ? "default" : "outline"}
            onClick={() =>
              placement?.mode === "add" ? disarmPlacement() : armAddViaClick()
            }
            data-testid={`button-add-pin-via-click-${vesselId}`}
          >
            <Crosshair className="h-4 w-4 mr-1" />
            {placement?.mode === "add" ? "Cancel placement" : "Add via 3D click"}
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

      {/* Embedded 3D viewer — shows current (unsaved) pin state and
          accepts click-to-place when placement is armed. Lazy + Suspense
          keeps Three.js out of the system-hub bundle. */}
      <div
        className={`h-[420px] rounded-md overflow-hidden border ${
          placement ? "ring-2 ring-primary cursor-crosshair" : ""
        }`}
        data-testid={`viewer-3d-${vesselId}`}
      >
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading 3D viewer…
            </div>
          }
        >
          <Vessel3DTwin
            modelUrl={`/api/v1/vessels/3d-model/${encodeURIComponent(model.id)}/binary`}
            pins={pins.filter((p) => p.equipmentId.trim().length > 0)}
            healthByEquipmentId={{}}
            placementMode={placement !== null}
            onPlaceAt={handlePlaceAt}
          />
        </Suspense>
      </div>

      {placementHint && (
        <p
          className="text-xs text-primary"
          data-testid={`text-placement-hint-${vesselId}`}
        >
          {placementHint}{" "}
          <button
            type="button"
            className="underline"
            onClick={disarmPlacement}
            data-testid={`button-cancel-placement-${vesselId}`}
          >
            Cancel
          </button>
        </p>
      )}

      {dirty && (
        <p className="text-xs text-muted-foreground" data-testid={`text-pins-unsaved-${vesselId}`}>
          Unsaved changes — click "Save pins" to persist.
        </p>
      )}

      {pins.some((p) => p.equipmentId.trim().length === 0) && (
        <p
          className="text-xs text-destructive"
          data-testid={`text-pins-missing-equipment-${vesselId}`}
        >
          {pins.filter((p) => p.equipmentId.trim().length === 0).length} pin(s)
          have no equipment selected and will be discarded on save. Use the
          Equipment selector on each row.
        </p>
      )}

      {pins.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pins yet. Use "Add via 3D click" to drop a pin directly on the
          model, or "Add empty row" to enter coordinates manually.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipment</TableHead>
              <TableHead className="w-24">X</TableHead>
              <TableHead className="w-24">Y</TableHead>
              <TableHead className="w-24">Z</TableHead>
              <TableHead>Label (optional)</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pins.map((p, i) => {
              const known = equipmentById.get(p.equipmentId);
              const isMoveTarget =
                placement?.mode === "move" && placement.targetIdx === i;
              return (
                <TableRow key={i} data-testid={`row-pin-${vesselId}-${i}`}>
                  <TableCell>
                    {equipmentList.length > 0 ? (
                      <Select
                        value={p.equipmentId || undefined}
                        onValueChange={(v) => updatePin(i, { equipmentId: v })}
                      >
                        <SelectTrigger
                          data-testid={`select-pin-equipment-${vesselId}-${i}`}
                        >
                          <SelectValue
                            placeholder={
                              p.equipmentId && !known
                                ? `${p.equipmentId} (not on vessel)`
                                : "Select equipment"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {equipmentList.map((eq) => (
                            <SelectItem
                              key={eq.id}
                              value={eq.id}
                              data-testid={`option-pin-equipment-${vesselId}-${i}-${eq.id}`}
                            >
                              {eq.name} ({eq.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={p.equipmentId}
                        onChange={(e) =>
                          updatePin(i, { equipmentId: e.target.value })
                        }
                        placeholder={
                          equipmentQuery.isLoading
                            ? "Loading equipment…"
                            : equipmentQuery.isError
                              ? "Equipment list unavailable — enter ID"
                              : "eq_…"
                        }
                        data-testid={`input-pin-equipment-${vesselId}-${i}`}
                      />
                    )}
                  </TableCell>
                  {(["x", "y", "z"] as const).map((axis) => (
                    <TableCell key={axis}>
                      <Input
                        type="number"
                        step="0.01"
                        value={p[axis]}
                        onChange={(e) =>
                          updatePin(i, {
                            [axis]: Number(e.target.value),
                          } as Partial<EquipmentPin>)
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
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant={isMoveTarget ? "default" : "ghost"}
                        onClick={() =>
                          isMoveTarget
                            ? disarmPlacement()
                            : armMoveViaClick(i)
                        }
                        data-testid={`button-place-pin-${vesselId}-${i}`}
                        aria-label={
                          isMoveTarget
                            ? "Cancel placement"
                            : "Move pin via 3D click"
                        }
                        title={
                          isMoveTarget
                            ? "Cancel placement"
                            : "Click here, then click on the 3D model"
                        }
                      >
                        <Crosshair className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removePin(i)}
                        data-testid={`button-remove-pin-${vesselId}-${i}`}
                        aria-label="Remove pin"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
