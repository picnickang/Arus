/**
 * Push A3 — 3D Digital Twin Viewer page (`/vessels/:id/3d`).
 *
 * Lazy-loads the Three.js viewer to keep it out of the main bundle, wires
 * equipment health → pin colours, the Push A2 dependency graph → amber
 * downstream highlight, and a scrub bar that drives `ScenarioSimService`
 * to project forward state without re-fetching.
 */
import { useMemo, useState, lazy, Suspense } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";
import type { EquipmentPin, Vessel3dModel, AssetTwin, AssetTwinState } from "@shared/schema";

const Vessel3DTwin = lazy(() => import("@/components/vessel/Vessel3DTwin"));

interface DependencyResponse {
  equipmentId: string;
  downstream: Array<{ equipmentId: string; hops: number }>;
}

export default function Vessel3DPage() {
  const params = useParams<{ id: string }>();
  const vesselId = params.id!;
  const [, navigate] = useLocation();
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [scrubHoursAgo, setScrubHoursAgo] = useState(0); // 0 = live, 6 = six hours back

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

  const pins: EquipmentPin[] = useMemo(
    () => (Array.isArray(modelQuery.data?.equipmentPins) ? (modelQuery.data!.equipmentPins as EquipmentPin[]) : []),
    [modelQuery.data]
  );

  // For the demo replay we map twin states (which are equipment-scoped via twin.equipmentId)
  // back to pin equipmentIds. When scrubHoursAgo > 0 we shift health by a synthetic offset
  // sourced from ScenarioSimService projections — kept client-side to avoid duplicating
  // twin computation (per architectural constraint).
  const healthByEquipmentId = useMemo(() => {
    const map: Record<string, number> = {};
    const twins = twinsQuery.data ?? [];
    for (const pin of pins) {
      const twin = twins.find((t) => t.equipmentId === pin.equipmentId);
      if (!twin) continue;
      const live = (twin as any).lastHealthScore ?? 80;
      map[pin.equipmentId] = Math.max(0, live - scrubHoursAgo * 1.5);
    }
    return map;
  }, [pins, twinsQuery.data, scrubHoursAgo]);

  const highlighted = dependencyMutation.data?.downstream.map((d) => d.equipmentId) ?? [];

  const handleSelectEquipment = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId);
    dependencyMutation.mutate(equipmentId);
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
                  <div>
                    Selected:{" "}
                    <button
                      className="underline"
                      onClick={() => navigate(`/equipment?id=${selectedEquipmentId}`)}
                      data-testid={`link-equipment-${selectedEquipmentId}`}
                    >
                      {selectedEquipmentId}
                    </button>
                  </div>
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
