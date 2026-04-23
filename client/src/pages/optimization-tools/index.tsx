import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  Play,
  RefreshCw,
  Search,
  Settings,
  Ship,
  TrendingUp,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useOptimizationData } from "@/features/maintenance";
import { ConfigDialog } from "./ConfigDialog";
import { ScenariosTab } from "./ScenariosTab";
import { RunsTab } from "./RunsTab";
import { RulTab } from "./RulTab";
import { TrendsTab } from "./TrendsTab";
import { FleetTab } from "./FleetTab";
import { RunDialog } from "./RunDialog";

// Fleet stats are computed locally to avoid hook caching issues - v2
export default function OptimizationTools() {
  const o = useOptimizationData();

  const { data: vessels } = useQuery<Array<{ id: string; name: string; active: boolean }>>({
    queryKey: ["/api/vessels"],
    queryFn: async () => {
      const r = await fetch("/api/vessels", { headers: { "x-org-id": "default-org-id" } });
      if (!r.ok) {
        throw new Error("Failed to fetch vessels");
      }
      return r.json();
    },
  });
  const { data: crew } = useQuery<Array<{ id: string; name: string; active: boolean }>>({
    queryKey: ["/api/crew"],
    queryFn: async () => {
      const r = await fetch("/api/crew", { headers: { "x-org-id": "default-org-id" } });
      if (!r.ok) {
        throw new Error("Failed to fetch crew");
      }
      return r.json();
    },
  });
  const fleetStats = {
    activeVessels: vessels?.filter((v) => v.active).length ?? 0,
    totalVessels: vessels?.length ?? 0,
    activeCrew: crew?.filter((c) => c.active).length ?? 0,
    totalCrew: crew?.length ?? 0,
  };

  return (
    <div className="min-h-screen">
      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={o.handleRefresh}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <ConfigDialog o={o} />
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search configurations and results..."
                  value={o.searchQuery}
                  onChange={(e) => o.setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Select value={o.statusFilter} onValueChange={o.setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs value={o.activeTab} onValueChange={o.setActiveTab} className="space-y-6">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex w-full min-w-fit p-1 gap-1">
              <TabsTrigger
                value="scenarios"
                data-testid="tab-scenarios"
                className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[80px] sm:min-w-[140px]"
              >
                <Settings className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Scenario Builder</span>
                <span className="sm:hidden">Scenario</span>
              </TabsTrigger>
              <TabsTrigger
                value="runs"
                data-testid="tab-runs"
                className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[80px] sm:min-w-[140px]"
              >
                <Play className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Solver Runs</span>
                <span className="sm:hidden">Runs</span>
              </TabsTrigger>
              <TabsTrigger
                value="rul"
                data-testid="tab-rul"
                className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[80px] sm:min-w-[140px]"
              >
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">RUL Analysis</span>
                <span className="sm:hidden">RUL</span>
              </TabsTrigger>
              <TabsTrigger
                value="trends"
                data-testid="tab-trends"
                className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[80px] sm:min-w-[140px]"
              >
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Trend Insights</span>
                <span className="sm:hidden">Trends</span>
              </TabsTrigger>
              <TabsTrigger
                value="fleet"
                data-testid="tab-fleet"
                className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[80px] sm:min-w-[140px]"
              >
                <Ship className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Fleet Controls</span>
                <span className="sm:hidden">Fleet</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="scenarios" className="space-y-6">
            <ScenariosTab o={o} />
          </TabsContent>

          <TabsContent value="runs" className="space-y-6">
            <RunsTab o={o} />
          </TabsContent>

          <TabsContent value="rul" className="space-y-6" data-testid="content-rul">
            <RulTab o={o} />
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <TrendsTab o={o} />
          </TabsContent>

          <TabsContent value="fleet" className="space-y-6">
            <FleetTab o={o} fleetStats={fleetStats} />
          </TabsContent>
        </Tabs>

        <RunDialog o={o} />
      </div>
    </div>
  );
}
