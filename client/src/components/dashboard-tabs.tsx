import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Cpu, Wrench } from "lucide-react";

interface DashboardTabsProps {
  overviewContent: React.ReactNode;
  devicesContent: React.ReactNode;
  maintenanceContent: React.ReactNode;
}

export function DashboardTabs({
  overviewContent,
  devicesContent,
  maintenanceContent,
}: DashboardTabsProps) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex mb-6">
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
    </Tabs>
  );
}
