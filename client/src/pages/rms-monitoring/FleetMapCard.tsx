import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Map, Navigation } from "lucide-react";
import type { FleetPosition, TrackPoint, RmsAlert, BunkeringEvent } from "./_shared";

export function FleetMapCard({
  positions,
  vesselTrack,
  selectedVessel,
  onSelectVessel,
  alerts,
  bunkerings,
}: {
  positions: FleetPosition[];
  vesselTrack: TrackPoint[];
  selectedVessel: string;
  onSelectVessel: (id: string) => void;
  alerts: RmsAlert[];
  bunkerings: BunkeringEvent[];
}) {
  const svgWidth = 700;
  const svgHeight = 340;
  const padding = 40;

  const validPositions = positions.filter((p) => p.latitude != null && p.longitude != null);
  const allPoints = useMemo(
    () => [
      ...validPositions.map((p) => ({ lat: +p.latitude!, lon: +p.longitude! })),
      ...vesselTrack.map((t) => ({ lat: +t.latitude, lon: +t.longitude })),
    ],
    [validPositions, vesselTrack]
  );

  const bounds = useMemo(() => {
    if (allPoints.length === 0) {
      return { minLat: 0, maxLat: 10, minLon: 100, maxLon: 120 };
    }
    const lats = allPoints.map((p) => p.lat);
    const lons = allPoints.map((p) => p.lon);
    const pad = 0.05;
    return {
      minLat: Math.min(...lats) - pad,
      maxLat: Math.max(...lats) + pad,
      minLon: Math.min(...lons) - pad,
      maxLon: Math.max(...lons) + pad,
    };
  }, [allPoints]);

  const project = (lat: number, lon: number) => {
    const latRange = bounds.maxLat - bounds.minLat || 1;
    const lonRange = bounds.maxLon - bounds.minLon || 1;
    return {
      x: padding + ((lon - bounds.minLon) / lonRange) * (svgWidth - 2 * padding),
      y: padding + ((bounds.maxLat - lat) / latRange) * (svgHeight - 2 * padding),
    };
  };

  const alertVesselIds = new Set(alerts.map((a) => a.vessel_id));
  const bunkeringVesselIds = new Set(bunkerings.map((b) => b.vessel_id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Map className="h-5 w-5 text-blue-600" />
          Fleet Map
        </CardTitle>
        <CardDescription>
          {validPositions.length} vessels with position data &middot; Click a vessel to select
        </CardDescription>
      </CardHeader>
      <CardContent>
        {validPositions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Navigation className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No position data available</p>
            <p className="text-sm">Vessel positions appear when FMCC or AIS data is ingested</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full border rounded-lg bg-slate-50 dark:bg-slate-900"
              data-testid="fleet-map-svg"
            >
              {[0.25, 0.5, 0.75].map((f) => (
                <g key={f}>
                  <line
                    x1={padding}
                    y1={padding + f * (svgHeight - 2 * padding)}
                    x2={svgWidth - padding}
                    y2={padding + f * (svgHeight - 2 * padding)}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeDasharray="4"
                  />
                  <line
                    x1={padding + f * (svgWidth - 2 * padding)}
                    y1={padding}
                    x2={padding + f * (svgWidth - 2 * padding)}
                    y2={svgHeight - padding}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeDasharray="4"
                  />
                </g>
              ))}
              <text
                x={padding}
                y={svgHeight - 5}
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.4}
              >
                {bounds.minLon.toFixed(2)}°E
              </text>
              <text
                x={svgWidth - padding}
                y={svgHeight - 5}
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.4}
                textAnchor="end"
              >
                {bounds.maxLon.toFixed(2)}°E
              </text>
              <text x={5} y={padding + 10} fontSize={9} fill="currentColor" fillOpacity={0.4}>
                {bounds.maxLat.toFixed(2)}°N
              </text>
              <text
                x={5}
                y={svgHeight - padding}
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.4}
              >
                {bounds.minLat.toFixed(2)}°N
              </text>

              {vesselTrack.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeOpacity={0.6}
                  points={vesselTrack
                    .map((t) => {
                      const p = project(+t.latitude, +t.longitude);
                      return `${p.x},${p.y}`;
                    })
                    .join(" ")}
                />
              )}

              {validPositions.map((v) => {
                const pos = project(+v.latitude!, +v.longitude!);
                const isSelected = selectedVessel === v.vessel_id;
                const hasAlert = alertVesselIds.has(v.vessel_id);
                const isBunkering = bunkeringVesselIds.has(v.vessel_id);
                const heading = v.heading || v.cog || 0;
                const freshness = v.last_position_at
                  ? (Date.now() - new Date(v.last_position_at).getTime()) / 60000
                  : Infinity;
                const isStale = freshness > 60;

                return (
                  <g
                    key={v.vessel_id}
                    className="cursor-pointer"
                    onClick={() => onSelectVessel(v.vessel_id)}
                    data-testid={`map-vessel-${v.vessel_id}`}
                  >
                    <g transform={`translate(${pos.x},${pos.y}) rotate(${heading})`}>
                      <polygon
                        points="0,-12 -6,6 6,6"
                        fill={
                          hasAlert
                            ? "#ef4444"
                            : isBunkering
                              ? "#3b82f6"
                              : isStale
                                ? "#9ca3af"
                                : "#22c55e"
                        }
                        stroke={isSelected ? "#000" : "none"}
                        strokeWidth={isSelected ? 2 : 0}
                        opacity={isStale ? 0.5 : 1}
                      />
                    </g>
                    <text
                      x={pos.x}
                      y={pos.y + 18}
                      textAnchor="middle"
                      fontSize={8}
                      fill="currentColor"
                      fillOpacity={0.8}
                      fontWeight={isSelected ? "bold" : "normal"}
                    >
                      {v.vessel_name?.substring(0, 12)}
                    </text>
                    <circle
                      cx={pos.x + 10}
                      cy={pos.y - 10}
                      r={3}
                      fill={isStale ? "#ef4444" : freshness > 30 ? "#f59e0b" : "#22c55e"}
                    />
                    {isBunkering && (
                      <circle
                        cx={pos.x - 10}
                        cy={pos.y - 10}
                        r={4}
                        fill="#3b82f6"
                        strokeWidth={1}
                        stroke="#fff"
                      >
                        <animate
                          attributeName="opacity"
                          values="1;0.3;1"
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              })}
            </svg>

            <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" /> Online
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-amber-500" /> &gt;30 min ago
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" /> Stale / Alert
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" /> Bunkering
              </div>
              <div className="flex items-center gap-1">
                <span className="text-blue-500">—</span> Track
              </div>
            </div>
            {validPositions.length > 0 && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {validPositions.map((v) => {
                  const freshness = v.last_position_at
                    ? (Date.now() - new Date(v.last_position_at).getTime()) / 60000
                    : Infinity;
                  const freshnessColor =
                    freshness > 60
                      ? "text-red-500"
                      : freshness > 30
                        ? "text-amber-500"
                        : "text-green-600";
                  return (
                    <div
                      key={v.vessel_id}
                      className="flex items-center gap-1.5 truncate"
                      data-testid={`freshness-${v.vessel_id}`}
                    >
                      <span className="font-medium truncate">{v.vessel_name || v.vessel_id}</span>
                      <span className={freshnessColor}>
                        {v.last_position_at
                          ? formatDistanceToNow(new Date(v.last_position_at), { addSuffix: true })
                          : "no data"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
