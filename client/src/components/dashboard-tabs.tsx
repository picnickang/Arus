import { useEffect, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Cpu, Wrench, Activity, Lightbulb } from "lucide-react";

const VALID_TABS = ["overview", "devices", "maintenance", "telemetry", "insights"] as const;
type TabValue = typeof VALID_TABS[number];

function getTabFromSearch(search: string): TabValue {
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  if (tab && VALID_TABS.includes(tab as TabValue)) {
    return tab as TabValue;
  }
  return "overview";
}

interface DashboardTabsProps {
  overviewContent: React.ReactNode;
  devicesContent: React.ReactNode;
  maintenanceContent: React.ReactNode;
  telemetryContent?: React.ReactNode;
  insightsContent?: React.ReactNode;
}

export function DashboardTabs({
  overviewContent,
  devicesContent,
  maintenanceContent,
  telemetryContent,
  insightsContent,
}: DashboardTabsProps) {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabValue>(() =>
    getTabFromSearch(searchString || window.location.search)
  );

  useEffect(() => {
    const tab = getTabFromSearch(searchString || "");
    setActiveTab(tab);
  }, [searchString]);

  const handleTabChange = (value: string) => {
    const tab = value as TabValue;
    setActiveTab(tab);
    const url = tab === "overview" ? "/dashboard" : `/dashboard?tab=${tab}`;
    setLocation(url, { replace: true });
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex mb-6">
        <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
          <LayoutDashboard className="h-4 w-4" />
          <span className="hidden sm:inline">Overview</span>
        </TabsTrigger>
        <TabsTrigger value="devices" className="gap-2" data-testid="tab-devices">
          <Cpu className="h-4 w-4" />
          <span className="hidden sm:inline">Devices</span>
        </TabsTrigger>
        <TabsTrigger value="maintenance" className="gap-2" data-testid="tab-maintenance">
          <Wrench className="h-4 w-4" />
          <span className="hidden sm:inline">Maintenance</span>
        </TabsTrigger>
        <TabsTrigger value="telemetry" className="gap-2" data-testid="tab-telemetry">
          <Activity className="h-4 w-4" />
          <span className="hidden sm:inline">Telemetry</span>
        </TabsTrigger>
        <TabsTrigger value="insights" className="gap-2" data-testid="tab-insights">
          <Lightbulb className="h-4 w-4" />
          <span className="hidden sm:inline">Insights</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6 mt-0">
        {overviewContent}
      </TabsContent>

      <TabsContent value="devices" className="space-y-6 mt-0">
        {devicesContent}
      </TabsContent>

      <TabsContent value="maintenance" className="space-y-6 mt-0">
        {maintenanceContent}
      </TabsContent>

      <TabsContent value="telemetry" className="space-y-6 mt-0">
        {telemetryContent}
      </TabsContent>

      <TabsContent value="insights" className="space-y-6 mt-0">
        {insightsContent}
      </TabsContent>
    </Tabs>
  );
}
