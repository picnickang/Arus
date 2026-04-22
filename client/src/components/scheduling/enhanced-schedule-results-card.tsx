import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, AlertTriangle, CheckCircle, Filter } from "lucide-react";
import { format } from "date-fns";
import FairnessViz from "../FairnessViz";
import type { Crew, ShiftPlanning } from "./crew-scheduler-cards";

export function EnhancedScheduleResultsCard({ p }: { p: ShiftPlanning }) {
  if (!p.enhancedScheduleResult) {
    return null;
  }
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Enhanced Schedule Results
          <Badge variant="outline">{p.enhancedScheduleResult.engine.toUpperCase()}</Badge>
        </CardTitle>
        <CardDescription>
          Advanced optimization results using {p.enhancedScheduleResult.engine} engine
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center border rounded p-3">
            <div className="text-2xl font-bold text-blue-600">
              {p.enhancedScheduleResult.summary.scheduledAssignments}
            </div>
            <div className="text-sm text-muted-foreground">Scheduled</div>
          </div>
          <div className="text-center border rounded p-3">
            <div className="text-2xl font-bold text-green-600">
              {(() => {
                const totalUnfilled = p.enhancedScheduleResult.unfilled.reduce(
                  (sum, u) => sum + u.need,
                  0
                );
                const total =
                  p.enhancedScheduleResult.summary.scheduledAssignments + totalUnfilled;
                return total > 0
                  ? (
                      (p.enhancedScheduleResult.summary.scheduledAssignments / total) *
                      100
                    ).toFixed(1)
                  : 0;
              })()}
              %
            </div>
            <div className="text-sm text-muted-foreground">Coverage</div>
          </div>
          <div className="text-center border rounded p-3">
            <div className="text-2xl font-bold text-orange-600">
              {p.enhancedScheduleResult.unfilled.reduce((sum, u) => sum + u.need, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Unfilled</div>
          </div>
          <div className="text-center border rounded p-3">
            <div className="text-2xl font-bold text-purple-600">
              {p.enhancedScheduleResult.summary.totalShifts}
            </div>
            <div className="text-sm text-muted-foreground">Total Shifts</div>
          </div>
        </div>
        <div className="mb-6">
          <FairnessViz scheduled={p.enhancedScheduleResult.scheduled} crew={p.crew} />
        </div>
        {p.enhancedScheduleResult?.compliance && (
          <div className="mb-6 p-4 border rounded-lg bg-muted/50">
            <h3 className="text-lg font-medium mb-3">STCW Compliance Summary</h3>
            <div className="mb-3">
              <span className="text-sm">Overall: </span>
              <Badge
                variant={
                  p.enhancedScheduleResult.compliance.overall_ok ? "default" : "destructive"
                }
              >
                {p.enhancedScheduleResult.compliance.overall_ok
                  ? "COMPLIANT"
                  : "VIOLATIONS DETECTED"}
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <p className="text-xs text-muted-foreground mb-2 sm:hidden">
                Scroll horizontally to see all columns
              </p>
              <table className="w-full text-sm border-collapse border border-border">
                <thead>
                  <tr className="bg-muted">
                    <th scope="col" className="border border-border px-2 py-1 text-left">
                      Crew
                    </th>
                    <th scope="col" className="border border-border px-2 py-1 text-center">
                      Status
                    </th>
                    <th scope="col" className="border border-border px-2 py-1 text-center">
                      MinRest24h
                    </th>
                    <th scope="col" className="border border-border px-2 py-1 text-center">
                      Rest7d
                    </th>
                    <th scope="col" className="border border-border px-2 py-1 text-center">
                      Nights/Week
                    </th>
                    <th scope="col" className="border border-border px-2 py-1 text-center">
                      Violations
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {p.enhancedScheduleResult.compliance.per_crew.map((crewComp, idx) => (
                    <tr
                      key={`crew-${crewComp.name}-${idx}`}
                      className={crewComp.ok ? "" : "bg-red-50 dark:bg-red-900/20"}
                    >
                      <td className="border border-border px-2 py-1">{crewComp.name}</td>
                      <td className="border border-border px-2 py-1 text-center">
                        <Badge variant={crewComp.ok ? "default" : "destructive"}>
                          {crewComp.ok ? "OK" : "BREACH"}
                        </Badge>
                      </td>
                      <td className="border border-border px-2 py-1 text-center">
                        {crewComp.min_rest_24?.toFixed(1) || "N/A"}h
                      </td>
                      <td className="border border-border px-2 py-1 text-center">
                        {crewComp.rest_7d?.toFixed(1) || "N/A"}h
                      </td>
                      <td className="border border-border px-2 py-1 text-center">
                        {crewComp.nights_this_week || 0}
                      </td>
                      <td className="border border-border px-2 py-1 text-center">
                        {crewComp.violations || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p
              className="text-xs text-muted-foreground mt-3"
              data-testid="text-stcw-disclaimer"
            >
              STCW compliance results shown here are projected and simulated based on the
              current schedule. They are advisory only and do not constitute official compliance
              verification. Always verify with your designated person ashore (DPA) and flag
              state requirements.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-3 mb-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <Label className="text-sm font-medium">Filters:</Label>
          </div>
          <Select value={p.filterVessel} onValueChange={p.setFilterVessel}>
            <SelectTrigger className="w-[180px]" data-testid="filter-vessel">
              <SelectValue placeholder="All Vessels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vessels</SelectItem>
              {p.vessels
                .filter((v) => v.id?.trim())
                .map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name || v.id}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={p.filterCrew} onValueChange={p.setFilterCrew}>
            <SelectTrigger className="w-[180px]" data-testid="filter-crew">
              <SelectValue placeholder="All Crew" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Crew</SelectItem>
              {p.crew.map((m: Crew) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search by role or date..."
            value={p.searchQuery}
            onChange={(e) => p.setSearchQuery(e.target.value)}
            className="w-[220px]"
            data-testid="input-search"
          />
          {(p.filterVessel !== "all" || p.filterCrew !== "all" || p.searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={p.clearFilters}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          )}
        </div>
        <Collapsible open={p.isEnhancedDetailsOpen} onOpenChange={p.setIsEnhancedDetailsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full mb-4">
              <ChevronDown className="h-4 w-4 mr-2" />
              {p.isEnhancedDetailsOpen ? "Hide" : "Show"} Detailed Schedule
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4">
            <Tabs defaultValue="assignments" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="assignments">Assignments</TabsTrigger>
                <TabsTrigger value="unfilled">Unfilled Positions</TabsTrigger>
              </TabsList>
              <TabsContent value="assignments" className="space-y-3">
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {p.enhancedScheduleResult.scheduled
                    .filter((a) => {
                      if (p.filterVessel !== "all" && a.vesselId !== p.filterVessel) {
                        return false;
                      }
                      if (p.filterCrew !== "all" && a.crewId !== p.filterCrew) {
                        return false;
                      }
                      if (p.searchQuery) {
                        const s = p.searchQuery.toLowerCase();
                        const matchesRole = a.role?.toLowerCase().includes(s);
                        const matchesDate = a.date.includes(s);
                        const matchesCrew = p.getCrewName(a.crewId).toLowerCase().includes(s);
                        if (!matchesRole && !matchesDate && !matchesCrew) {
                          return false;
                        }
                      }
                      return true;
                    })
                    .map((a, i) => (
                      <div key={i} className="border rounded p-3 bg-muted/30">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{p.getCrewName(a.crewId)}</div>
                            <div className="text-sm text-muted-foreground">
                              {a.role} • {format(new Date(a.date), "MMM d")} •{" "}
                              {p.getShiftTime(a.start.slice(11, 19), a.end.slice(11, 19))}
                            </div>
                          </div>
                          <Badge variant="outline">
                            {a.vesselId ? p.getVesselName(a.vesselId) : "Fleet"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              </TabsContent>
              <TabsContent value="unfilled" className="space-y-3">
                {p.enhancedScheduleResult.unfilled.length === 0 ? (
                  <div className="text-center text-green-600 p-6">
                    All positions successfully filled!
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {p.enhancedScheduleResult.unfilled.map((u, i) => (
                      <div key={i} className="border rounded p-3 bg-red-50">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-red-700">
                              {u.need} position(s) unfilled
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Day: {u.day} • Shift: {u.shiftId}
                            </div>
                            <div className="text-sm text-red-600">Reason: {u.reason}</div>
                          </div>
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
