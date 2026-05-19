/**
 * Push A3 — 3D Digital Twin Viewer page (`/vessels/:id/3d`).
 *
 * Lazy-loads the Three.js viewer to keep it out of the main bundle, wires
 * equipment health → pin colours, the Push A2 dependency graph → amber
 * downstream highlight, and a scrub bar that replays health from the
 * existing `TwinStateService.getStateHistory()` records — keeping twin
 * computation server-side per architectural constraint.
 *
 * Pin click → immediately routes to the equipment detail page; the
 * dependency graph fetch fires in parallel so the operator sees the
 * downstream amber tint when they return.
 */
import { useMemo, useState, useEffect, lazy, Suspense } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";
import type {
  EquipmentPin,
  Vessel3dModel,
  AssetTwin,
  AssetTwinState,
} from "@shared/schema";

const Vessel3DTwin = lazy(() => import("@/components/vessel/Vessel3DTwin"));

interface DependencyResponse {
  equipmentId: string;
  downstream: Array<{ equipmentId: string; hops: number }>;
}

type PinList = EquipmentPin[];

function parsePins(raw: unknown): PinList {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is EquipmentPin => {
    return (
      !!p &&
      typeof p === "object" &&
      typeof (p as EquipmentPin).equipmentId === "string" &&
      typeof (p as EquipmentPin).x === "number" &&
      typeof (p as EquipmentPin).y === "number" &&
      typeof (p as EquipmentPin).z === "number"
    );
  });
}

export default function Vessel3DPage() {
  const params = useParams<{ id: string }>();
  const vesselId = params.id!;
  const [, navigate] = useLocation();
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [scrubHoursAgo, setScrubHoursAgo] = useState(0); // 0 = live, up to 6h back

  const modelQuery = useQuery<Vessel3dModel>({
    queryKey: ["/api/v1/vessels", vesselId, "3d-model"],
  });

  const twinsQuery = useQuery<AssetTwin[]>({
    queryKey: ["/api/pdm/twin/def/twins"],
  });

  const dependencyMutation = useMutation<DependencyResponse, Error, string>({
    mutationFn: async (equipmentId) => {
      const res = (await apiRequest(
        "GET",
        `/api/v1/vessels/equipment/${encodeURIComponent(equipmentId)}/dependencies`
      )) as Response;
      return res.json();
    },
  });

  const pins: PinList = useMemo(
    () => parsePins(modelQuery.data?.equipmentPins),
    [modelQuery.data]
  );

  // Fetch the last ~6h of twin states for every twin that has a pin in this
  // model. Replay uses these real snapshots — no client-side twin computation.
  const pinnedTwins = useMemo(() => {
    const twins = twinsQuery.data ?? [];
    const wanted = new Set(pins.map((p) => p.equipmentId));
    return twins.filter((t) => wanted.has(t.equipmentId));
  }, [twinsQuery.data, pins]);

  const historyQueries = useQueries({
    queries: pinnedTwins.map((twin) => ({
      queryKey: ["/api/pdm/twin/state/history", twin.id, { limit: 120 }],
      queryFn: async () => {
        const res = (await apiRequest(
          "GET",
          `/api/pdm/twin/state/history/${encodeURIComponent(twin.id)}?limit=120`
        )) as Response;
        const arr = (await res.json()) as AssetTwinState[];
        return { twinId: twin.id, equipmentId: twin.equipmentId, history: arr };
      },
    })),
  });

  // Pick the snapshot whose timestamp is closest to (now - scrubHoursAgo h).
  // At scrubHoursAgo === 0 we use the latest snapshot ("live").
  const healthByEquipmentId = useMemo(() => {
    const targetMs = Date.now() - scrubHoursAgo * 3600 * 1000;
    const map: Record<string, number> = {};
    for (const q of historyQueries) {
      if (!q.data) continue;
      const { equipmentId, history } = q.data;
      if (history.length === 0) continue;
      let best: AssetTwinState | undefined;
      let bestDelta = Infinity;
      for (const snap of history) {
        const t = snap.timestamp ? new Date(snap.timestamp).getTime() : 0;
        const delta = Math.abs(t - targetMs);
        if (delta < bestDelta) {
          bestDelta = delta;
          best = snap;
        }
      }
      if (best && typeof best.healthScore === "number") {
        map[equipmentId] = best.healthScore;
      }
    }
    return map;
  }, [historyQueries, scrubHoursAgo]);

  const highlighted = dependencyMutation.data?.downstream.map((d) => d.equipmentId) ?? [];

  // Reset the dependency overlay when the model or selection clears.
  useEffect(() => {
    if (!selectedEquipmentId) dependencyMutation.reset();
    // dependencyMutation is stable from react-query; intentionally not in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEquipmentId]);

  // Pin click: navigate to equipment detail immediately, AND fire the
  // dependency lookup so the overlay is ready when the operator returns.
  const handleSelectEquipment = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId);
    dependencyMutation.mutate(equipmentId);
    navigate(`/equipment?id=${encodeURIComponent(equipmentId)}`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle data-testid="text-vessel-3d-title">3D Digital Twin</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/vessels/${vesselId}`)}
            data-testid="button-back-2d"
          >
            Back to 2D
          </Button>
        </CardHeader>
        <CardContent>
          {modelQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading model…
            </div>
          ) : modelQuery.isError || !modelQuery.data ? (
            <div className="text-sm text-muted-foreground" data-testid="text-no-3d-model">
              No 3D model attached to this vessel. An admin can upload a glTF/glb (≤100 MB)
              via <code className="px-1 bg-muted rounded">POST /api/v1/vessels/{vesselId}/3d-model</code>.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-[60vh] min-h-[480px] rounded-md overflow-hidden border">
                <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading viewer…</div>}>
                  <Vessel3DTwin
                    modelUrl={`/api/v1/vessels/3d-model/${modelQuery.data.id}/binary`}
                    pins={pins}
                    healthByEquipmentId={healthByEquipmentId}
                    highlightedEquipmentIds={highlighted}
                    onSelectEquipment={handleSelectEquipment}
                  />
                </Suspense>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span data-testid="text-scrub-label">
                    Replay: {scrubHoursAgo === 0 ? "live" : `${scrubHoursAgo}h ago`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setScrubHoursAgo(0)}
                    data-testid="button-scrub-live"
                  >
                    Jump to live
                  </Button>
                </div>
                <Slider
                  min={0}
                  max={6}
                  step={1}
                  value={[scrubHoursAgo]}
                  onValueChange={(v) => setScrubHoursAgo(v[0] ?? 0)}
                  data-testid="slider-scrub"
                />
              </div>

              {selectedEquipmentId && (
                <div className="text-sm space-y-1">
                  <div data-testid="text-selected-equipment">Selected: {selectedEquipmentId}</div>
                  {dependencyMutation.isPending && (
                    <div className="text-muted-foreground">Fetching dependency graph…</div>
                  )}
                  {highlighted.length > 0 && (
                    <div data-testid="text-dependency-count">
                      {highlighted.length} downstream equipment would degrade if this fails (amber pins).
                    </div>
                  )}
                  {!dependencyMutation.isPending && highlighted.length === 0 && dependencyMutation.data && (
                    <div className="text-muted-foreground">No downstream dependencies recorded.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
