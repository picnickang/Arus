import { format } from "date-fns";
import { Navigation, Ship, Calendar, RefreshCw, MapPin, Compass, Gauge, Download, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useVesselTrackData, formatCoordinate } from "@/features/deck-logbook";

const NavStatusColors: Record<string, string> = { underway: "bg-green-500", anchored: "bg-blue-500", moored: "bg-purple-500", maneuvering: "bg-yellow-500", not_under_command: "bg-red-500" };
const NavStatusLabels: Record<string, string> = { underway: "Underway", anchored: "At Anchor", moored: "Moored", maneuvering: "Maneuvering", not_under_command: "Not Under Command" };

export default function VesselTrackLogPage() {
  const { vessels, tracks, tracksLoading, stats, statsLoading, lastPosition, selectedVessel, setSelectedVessel, dateRange, setDateRange, activeTab, setActiveTab, navStatusDistribution, processTelemetryMutation, handleProcessTelemetry, exportGpx } = useVesselTrackData();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap"><Select value={selectedVessel} onValueChange={setSelectedVessel}><SelectTrigger className="w-[200px]" data-testid="select-vessel"><Ship className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Select Vessel" /></SelectTrigger><SelectContent>{vessels.filter(v => v.id).map((vessel) => <SelectItem key={vessel.id} value={vessel.id}>{vessel.name}</SelectItem>)}</SelectContent></Select><Select value={dateRange} onValueChange={setDateRange}><SelectTrigger className="w-[150px]" data-testid="select-date-range"><Calendar className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1h">Last Hour</SelectItem><SelectItem value="6h">Last 6 Hours</SelectItem><SelectItem value="24h">Last 24 Hours</SelectItem><SelectItem value="7d">Last 7 Days</SelectItem></SelectContent></Select>{selectedVessel && <><Button variant="outline" onClick={() => handleProcessTelemetry(selectedVessel)} disabled={processTelemetryMutation.isPending} data-testid="button-process"><RefreshCw className={`h-4 w-4 mr-2 ${processTelemetryMutation.isPending ? "animate-spin" : ""}`} />Process GPS Data</Button><Button variant="outline" onClick={exportGpx} data-testid="button-export-gpx"><Download className="h-4 w-4 mr-2" />Export GPX</Button></>}</div>
      </div>

      {!selectedVessel ? (<Card className="text-center py-12"><CardContent><Ship className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" /><h3 className="text-lg font-semibold mb-2">Select a Vessel</h3><p className="text-muted-foreground">Choose a vessel from the dropdown to view its track history</p></CardContent></Card>) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Last Position</CardTitle><MapPin className="h-4 w-4 text-red-500" /></CardHeader><CardContent>{lastPosition ? <><div className="text-lg font-bold" data-testid="text-last-position">{formatCoordinate(lastPosition.latitude, "lat")}</div><div className="text-lg font-bold">{formatCoordinate(lastPosition.longitude, "lon")}</div><p className="text-xs text-muted-foreground mt-1">{format(new Date(lastPosition.timestamp), "MMM dd, HH:mm:ss")}</p></> : <p className="text-muted-foreground">No position data</p>}</CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Distance Traveled</CardTitle><Activity className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-2xl font-bold" data-testid="text-distance">{stats?.totalDistanceNm?.toFixed(2) || "0.00"} NM</div><p className="text-xs text-muted-foreground">{stats?.trackPointCount || 0} track points</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Average Speed</CardTitle><Gauge className="h-4 w-4 text-blue-600" /></CardHeader><CardContent><div className="text-2xl font-bold" data-testid="text-avg-speed">{stats?.avgSpeedKn?.toFixed(1) || "0.0"} kn</div><p className="text-xs text-muted-foreground">Max: {stats?.maxSpeedKn?.toFixed(1) || "0.0"} kn</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Current Speed</CardTitle><Compass className="h-4 w-4 text-purple-600" /></CardHeader><CardContent><div className="text-2xl font-bold" data-testid="text-current-speed">{lastPosition?.sog?.toFixed(1) || "0.0"} kn</div><p className="text-xs text-muted-foreground">COG: {lastPosition?.cog?.toFixed(0) || "---"}°</p></CardContent></Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList><TabsTrigger value="overview" data-testid="tab-overview"><Activity className="h-4 w-4 mr-2" />Overview</TabsTrigger><TabsTrigger value="track" data-testid="tab-track"><Navigation className="h-4 w-4 mr-2" />Track History</TabsTrigger></TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card><CardHeader><CardTitle>Voyage Summary</CardTitle><CardDescription>From start to end position</CardDescription></CardHeader><CardContent>{statsLoading ? <Skeleton className="h-32 w-full" /> : stats?.startPosition && stats?.endPosition ? <div className="space-y-4"><div className="flex items-start gap-3"><div className="w-2 h-2 rounded-full bg-green-500 mt-2" /><div><p className="font-medium">Start Position</p><p className="text-sm text-muted-foreground">{formatCoordinate(stats.startPosition.lat, "lat")}, {formatCoordinate(stats.startPosition.lon, "lon")}</p></div></div><div className="ml-1 border-l-2 border-dashed h-8 border-muted-foreground/30" /><div className="flex items-start gap-3"><div className="w-2 h-2 rounded-full bg-red-500 mt-2" /><div><p className="font-medium">End Position</p><p className="text-sm text-muted-foreground">{formatCoordinate(stats.endPosition.lat, "lat")}, {formatCoordinate(stats.endPosition.lon, "lon")}</p></div></div></div> : <div className="text-center py-8 text-muted-foreground"><Navigation className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No track data for this period</p><Button variant="outline" className="mt-4" onClick={() => handleProcessTelemetry(selectedVessel)} data-testid="button-process-empty"><RefreshCw className="h-4 w-4 mr-2" />Process GPS Data</Button></div>}</CardContent></Card>
                <Card><CardHeader><CardTitle>Navigation Status Distribution</CardTitle><CardDescription>Time spent in each status</CardDescription></CardHeader><CardContent>{tracksLoading ? <Skeleton className="h-32 w-full" /> : tracks.length > 0 ? <div className="space-y-3">{Object.entries(navStatusDistribution).map(([status, count]) => <div key={status} className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full ${NavStatusColors[status] || "bg-gray-400"}`} /><span className="flex-1">{NavStatusLabels[status] || status}</span><Badge variant="secondary">{count}</Badge></div>)}</div> : <p className="text-center text-muted-foreground py-8">No data available</p>}</CardContent></Card>
              </div>
            </TabsContent>

            <TabsContent value="track" className="space-y-4">
              <Card><CardHeader><CardTitle>Track History</CardTitle><CardDescription>Position log with navigation data</CardDescription></CardHeader><CardContent>{tracksLoading ? <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : tracks.length === 0 ? <div className="text-center py-8 text-muted-foreground"><p>No track entries for this period</p></div> : <div className="rounded-md border overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Position</TableHead><TableHead className="text-right">SOG (kn)</TableHead><TableHead className="text-right">COG (°)</TableHead><TableHead className="text-right">Heading (°)</TableHead><TableHead>Status</TableHead><TableHead>Source</TableHead></TableRow></TableHeader><TableBody>{tracks.slice(0, 100).map((track) => <TableRow key={track.id} data-testid={`row-track-${track.id}`}><TableCell className="font-medium">{format(new Date(track.timestamp), "MMM dd HH:mm:ss")}</TableCell><TableCell className="font-mono text-sm">{formatCoordinate(track.latitude, "lat")}<br />{formatCoordinate(track.longitude, "lon")}</TableCell><TableCell className="text-right">{track.sog?.toFixed(1) || "-"}</TableCell><TableCell className="text-right">{track.cog?.toFixed(0) || "-"}</TableCell><TableCell className="text-right">{track.heading?.toFixed(0) || "-"}</TableCell><TableCell><Badge className={NavStatusColors[track.navStatus || ""] || "bg-gray-400"}>{NavStatusLabels[track.navStatus || ""] || track.navStatus}</Badge></TableCell><TableCell><Badge variant="outline">{track.source}</Badge></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
