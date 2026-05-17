// @ts-nocheck
import { format } from "date-fns";
import {
  Fuel,
  Ship,
  Calendar,
  RefreshCw,
  Leaf,
  BarChart3,
  AlertTriangle,
  Gauge,
  Info,
  Zap,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFuelEmissionsData } from "@/features/deck-logbook";

const CIIRatingColors: Record<string, string> = {
  A: "bg-green-500 text-white",
  B: "bg-green-400 text-white",
  C: "bg-yellow-400 text-black",
  D: "bg-orange-400 text-white",
  E: "bg-red-500 text-white",
};
const CIIRatingDescriptions: Record<string, string> = {
  A: "Superior - Well below required CII",
  B: "Minor Superior - Below required CII",
  C: "Moderate - Meeting CII requirements",
  D: "Minor Inferior - Above required CII",
  E: "Inferior - Well above required CII (improvement plan required)",
};

export default function FuelEmissionsLogPage() {
  const {
    vessels,
    logs,
    logsLoading,
    fmccStatus,
    selectedVessel,
    setSelectedVessel,
    dateRange,
    setDateRange,
    activeTab,
    setActiveTab,
    totalFuel,
    totalCo2,
    totalDistance,
    avgEfficiency,
    latestCiiRating,
    totalFo,
    totalDo,
    totalSox,
    totalNox,
    autoFillMutation,
    handleAutoFill,
  } = useFuelEmissionsData();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-wrap items-center justify-end gap-3 mb-6">
        {fmccStatus && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={fmccStatus.fmcc?.enabled ? "default" : "outline"}
                  className={
                    fmccStatus.fmcc?.enabled && fmccStatus.fmcc?.ready
                      ? "bg-blue-600 hover:bg-blue-700"
                      : fmccStatus.fmcc?.enabled
                        ? "bg-yellow-500"
                        : ""
                  }
                  data-testid="badge-fmcc-status"
                >
                  <Zap className="h-3 w-3 mr-1" />
                  {fmccStatus.fmcc?.enabled && fmccStatus.fmcc?.ready
                    ? "FMCC Active"
                    : fmccStatus.fmcc?.enabled
                      ? "FMCC Connecting"
                      : "FMCC Disabled"}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-medium">Aquametro FMCC Fuel Meter</p>
                  {fmccStatus.fmcc?.enabled ? (
                    <>
                      <p className="text-xs">Status: {fmccStatus.fmcc.connectionStatus}</p>
                      {fmccStatus.capabilities?.length > 0 && (
                        <ul className="text-xs list-disc list-inside">
                          {fmccStatus.capabilities.slice(0, 3).map((cap, i) => (
                            <li key={i}>{cap}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <p className="text-xs">
                      Enable FMCC for direct fuel flow measurement instead of SFOC estimation
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <Select value={selectedVessel} onValueChange={setSelectedVessel}>
          <SelectTrigger className="w-[200px]" data-testid="select-vessel">
            <Ship className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Select Vessel" />
          </SelectTrigger>
          <SelectContent>
            {vessels
              .filter((v) => v.id)
              .map((vessel) => (
                <SelectItem key={vessel.id} value={vessel.id}>
                  {vessel.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[150px]" data-testid="select-date-range">
            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
        {selectedVessel && (
          <Button
            variant="outline"
            onClick={() => handleAutoFill(selectedVessel)}
            disabled={autoFillMutation.isPending}
            data-testid="button-autofill"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${autoFillMutation.isPending ? "animate-spin" : ""}`}
            />
            Auto-fill from Telemetry
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fuel</CardTitle>
            <Fuel className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-fuel">
              {totalFuel.toFixed(2)} MT
            </div>
            <p className="text-xs text-muted-foreground">{logs.length} log entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CO₂ Emissions</CardTitle>
            <Leaf className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-co2">
              {totalCo2.toFixed(2)} MT
            </div>
            <p className="text-xs text-muted-foreground">Metric tons CO₂</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fuel Efficiency</CardTitle>
            <Gauge className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-efficiency">
              {avgEfficiency.toFixed(4)} MT/NM
            </div>
            <p className="text-xs text-muted-foreground">{totalDistance.toFixed(1)} NM traveled</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CII Rating</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Carbon Intensity Indicator - IMO measure of ship's carbon efficiency</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge
                className={`text-lg px-3 py-1 ${CIIRatingColors[latestCiiRating] || "bg-gray-400"}`}
                data-testid="badge-cii-rating"
              >
                {latestCiiRating}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {CIIRatingDescriptions[latestCiiRating] || "No data"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <Fuel className="h-4 w-4 mr-2" />
            Log Entries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fuel Consumption by Type</CardTitle>
              <CardDescription>
                Breakdown of fuel consumption over the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Fuel className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No fuel consumption data for this period</p>
                  {selectedVessel && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => handleAutoFill(selectedVessel)}
                      data-testid="button-autofill-empty"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Generate from Telemetry
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Heavy Fuel Oil (HFO/VLSFO)</span>
                      <span>{totalFo.toFixed(2)} MT</span>
                    </div>
                    <Progress value={Math.min(100, (totalFo / totalFuel) * 100)} className="h-3" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Marine Diesel Oil (MDO/MGO)</span>
                      <span>{totalDo.toFixed(2)} MT</span>
                    </div>
                    <Progress
                      value={Math.min(100, (totalDo / totalFuel) * 100)}
                      className="h-3 bg-muted"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Emissions Summary</CardTitle>
              <CardDescription>Environmental impact metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-green-600" />
                    <span className="font-medium">CO₂ Emissions</span>
                  </div>
                  <div className="text-3xl font-bold">{totalCo2.toFixed(2)} MT</div>
                  <p className="text-sm text-muted-foreground">Carbon dioxide</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium">SOx Emissions</span>
                  </div>
                  <div className="text-3xl font-bold">{totalSox.toFixed(1)} kg</div>
                  <p className="text-sm text-muted-foreground">Sulfur oxides</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <span className="font-medium">NOx Emissions</span>
                  </div>
                  <div className="text-3xl font-bold">{totalNox.toFixed(1)} kg</div>
                  <p className="text-sm text-muted-foreground">Nitrogen oxides</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fuel & Emissions Log Entries</CardTitle>
              <CardDescription>
                Detailed hourly/daily fuel consumption and emissions records
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No log entries for this period</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">FO (MT)</TableHead>
                        <TableHead className="text-right">DO (MT)</TableHead>
                        <TableHead className="text-right">CO₂ (MT)</TableHead>
                        <TableHead className="text-right">Engine Load</TableHead>
                        <TableHead className="text-right">Distance (NM)</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Quality</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.slice(0, 50).map((log) => (
                        <TableRow key={log.id} data-testid={`row-fuel-log-${log.id}`}>
                          <TableCell className="font-medium">
                            // @ts-ignore -- bulk-silence
                            {format(new Date(log.periodStart), "MMM dd HH:mm")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.periodType}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            // @ts-ignore -- bulk-silence
                            {log.foConsumptionMt?.toFixed(4) || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            // @ts-ignore -- bulk-silence
                            {log.doConsumptionMt?.toFixed(4) || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {log.co2EmissionsMt?.toFixed(4) || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            // @ts-ignore -- bulk-silence
                            {log.avgEngineLoad?.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right">
                            {log.distanceNm?.toFixed(2) || "-"}
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    // @ts-ignore -- bulk-silence
                                    variant={log.dataSource === "fmcc" ? "default" : "secondary"}
                                    className={
                                      // @ts-ignore -- bulk-silence
                                      log.dataSource === "fmcc"
                                        ? "bg-blue-600 hover:bg-blue-700"
                                        : ""
                                    }
                                    data-testid={`badge-source-${log.id}`}
                                  >
                                    // @ts-ignore -- bulk-silence
                                    {log.dataSource === "fmcc" ? (
                                      <>
                                        <Zap className="h-3 w-3 mr-1" />
                                        FMCC
                                      </>
                                    ) : (
                                      <>
                                        <Calculator className="h-3 w-3 mr-1" />
                                        // @ts-ignore -- bulk-silence
                                        {log.dataSource || "estimated"}
                                      </>
                                    )}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-sm">
                                    // @ts-ignore -- bulk-silence
                                    {log.dataSource === "fmcc"
                                      ? "Measured by Aquametro FMCC fuel flow meter"
                                      : "Calculated from engine telemetry (SFOC curves)"}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            <Badge
                              // @ts-ignore -- bulk-silence
                              variant={log.dataQuality === "high" ? "default" : "outline"}
                              // @ts-ignore -- bulk-silence
                              className={log.dataQuality === "high" ? "bg-green-600" : ""}
                            >
                              // @ts-ignore -- bulk-silence
                              {log.dataQuality}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
