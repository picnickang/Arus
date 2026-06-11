/**
 * Task #80 — "Across the fleet" panel for the PdM Equipment Detail
 * view. Surfaces top failure modes observed on peer equipment of
 * the same type, on other vessels of the same class within the
 * caller's org. Each row drills down to the parts historically
 * consumed for that failure mode.
 *
 * Reads:
 *   GET /api/v1/equipment/:id/cross-class-patterns
 *   GET /api/v1/equipment/:id/cross-class-patterns/:failureMode/parts
 *
 * Cross-tenant safety: enforced server-side via RLS on the
 * peer-vessel SQL and per-tenant graph isolation on the cypher
 * query. This component is a thin renderer.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Globe2 } from "lucide-react";

interface PatternRow {
  failureMode: string;
  occurrences: number;
  vesselCount: number;
}
interface PatternsResponse {
  vesselClass: string | null;
  equipmentType: string;
  peerVesselCount: number;
  patterns: PatternRow[];
  reason?: string;
}
interface PartRow {
  partId: string;
  occurrences: number;
}
interface PartsResponse {
  failureMode: string;
  parts: PartRow[];
}

export function CrossClassPatternsCard({ equipmentId }: { equipmentId: string }) {
  const [openFailureMode, setOpenFailureMode] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery<PatternsResponse>({
    queryKey: ["/api/v1/equipment", equipmentId, "cross-class-patterns"],
  });

  return (
    <Card data-testid="card-cross-class-patterns">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="h-4 w-4" />
            Across the fleet
          </CardTitle>
          {data?.vesselClass && (
            <Badge variant="outline" data-testid="badge-vessel-class">
              {data.vesselClass} · {data.peerVesselCount} peer vessel
              {data.peerVesselCount === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Top failure modes seen on equipment of the same type on other vessels of the same class.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-2" data-testid="loading-cross-class">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive" data-testid="error-cross-class">
            Failed to load cross-fleet patterns
            {error instanceof Error ? `: ${error.message}` : ""}.
          </p>
        )}

        {!isLoading && !isError && data && data.reason === "vessel_class_not_set" && (
          <p className="text-sm text-muted-foreground" data-testid="empty-cross-class-no-class">
            Vessel class isn't set — assign a class to this vessel to compare against the rest of
            the fleet.
          </p>
        )}

        {!isLoading && !isError && data && data.reason === "equipment_not_assigned_to_vessel" && (
          <p className="text-sm text-muted-foreground" data-testid="empty-cross-class-no-vessel">
            This equipment isn't assigned to a vessel — assign it to compare against peers on other
            vessels of the same class.
          </p>
        )}

        {!isLoading && !isError && data && !data.reason && data.patterns.length === 0 && (
          <p className="text-sm text-muted-foreground" data-testid="empty-cross-class">
            {data.peerVesselCount === 0
              ? "No peer vessels of this class in the fleet yet."
              : "No failure history recorded on peer equipment yet."}
          </p>
        )}

        {!isLoading && !isError && data && data.patterns.length > 0 && (
          <ul className="divide-y rounded-md border">
            {data.patterns.map((p) => {
              const pct =
                data.peerVesselCount > 0
                  ? Math.round((p.vesselCount / data.peerVesselCount) * 100)
                  : 0;
              const isOpen = openFailureMode === p.failureMode;
              return (
                <li key={p.failureMode}>
                  <button
                    type="button"
                    onClick={() => setOpenFailureMode(isOpen ? null : p.failureMode)}
                    className="w-full text-left px-3 py-2 hover-elevate active-elevate-2 flex items-center justify-between gap-3"
                    data-testid={`row-cross-class-pattern-${p.failureMode}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{p.failureMode}</span>
                      <span className="text-xs text-muted-foreground">
                        {pct}% of peer vessels · {p.occurrences} occurrence
                        {p.occurrences === 1 ? "" : "s"} · {p.vesselCount} vessel
                        {p.vesselCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <PartsDrillDown equipmentId={equipmentId} failureMode={p.failureMode} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PartsDrillDown({
  equipmentId,
  failureMode,
}: {
  equipmentId: string;
  failureMode: string;
}) {
  // `failureMode` may contain `/`, spaces, or other characters that
  // collide with URL path syntax — encode it as a path segment.
  // Note: the default queryFn builds the URL by joining the key
  // array with `/`, so we encode the segment that's interpolated
  // into the path, not the join itself.
  const encodedFm = encodeURIComponent(failureMode);
  const { data, isLoading, isError, error } = useQuery<PartsResponse>({
    queryKey: ["/api/v1/equipment", equipmentId, "cross-class-patterns", encodedFm, "parts"],
  });

  return (
    <div className="px-3 py-2 bg-muted/30 border-t" data-testid={`drilldown-parts-${failureMode}`}>
      {isLoading && <Skeleton className="h-6 w-full" />}
      {isError && (
        <p className="text-xs text-destructive">
          Failed to load parts
          {error instanceof Error ? `: ${error.message}` : ""}.
        </p>
      )}
      {!isLoading && !isError && data && data.parts.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No parts have been recorded against this failure mode yet.
        </p>
      )}
      {!isLoading && !isError && data && data.parts.length > 0 && (
        <ul className="space-y-1">
          {data.parts.slice(0, 10).map((part) => (
            <li
              key={part.partId}
              className="flex items-center justify-between text-xs"
              data-testid={`row-part-${part.partId}`}
            >
              <span className="font-mono">{part.partId}</span>
              <Badge variant="secondary">
                {part.occurrences} use{part.occurrences === 1 ? "" : "s"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
