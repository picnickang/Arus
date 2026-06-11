import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Clock, FileText, Ship, Users, Zap } from "lucide-react";
import { PageHeader } from "@/components/navigation";
import { useEngineLogbookData } from "@/features/engine-logbook";
import { EngineLogbookHero } from "./engine-logbook/EngineLogbookHero";
import { HourlyTab } from "./engine-logbook/HourlyTab";
import { GeneratorsTab } from "./engine-logbook/GeneratorsTab";
import { EventsTab } from "./engine-logbook/EventsTab";
import { WatchesTab } from "./engine-logbook/WatchesTab";
import { SummaryTab } from "./engine-logbook/SummaryTab";
import { SignOffFooter } from "./engine-logbook/SignOffFooter";

const VALID_LOGBOOK_TABS = ["hourly", "generators", "events", "watches", "summary"] as const;

export default function EngineLogbookPage() {
  const e = useEngineLogbookData();
  const search = useSearch();
  const [location, setLocation] = useLocation();
  const { setActiveTab, setNewEventDialogOpen } = e;

  useEffect(() => {
    const tab = new URLSearchParams(search).get("tab");
    if (tab && (VALID_LOGBOOK_TABS as readonly string[]).includes(tab)) {
      setActiveTab(tab);
    }
  }, [search, setActiveTab]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new") {
      setActiveTab("events");
      setNewEventDialogOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [setActiveTab, setNewEventDialogOpen]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setLocation(`${location}?tab=${tab}`, { replace: true });
  };

  if (e.loadingVessels) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <PageHeader title="Engine Logbook" />
      <div className="p-6 space-y-6">
        <EngineLogbookHero e={e} />

        {!e.selectedVesselId ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Ship className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select a Vessel</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Choose a vessel from the dropdown above to view or edit its engine room logbook
                entries.
              </p>
            </CardContent>
          </Card>
        ) : e.loadingEngineLog ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Tabs value={e.activeTab} onValueChange={handleTabChange}>
            <TabsList className="flex w-full overflow-x-auto">
              <TabsTrigger value="hourly" data-testid="tab-hourly">
                <Clock className="h-4 w-4 mr-2" />
                Hourly Log
              </TabsTrigger>
              <TabsTrigger value="generators" data-testid="tab-generators">
                <Zap className="h-4 w-4 mr-2" />
                Generators
              </TabsTrigger>
              <TabsTrigger value="events" data-testid="tab-events">
                <Activity className="h-4 w-4 mr-2" />
                Events
              </TabsTrigger>
              <TabsTrigger value="watches" data-testid="tab-watches">
                <Users className="h-4 w-4 mr-2" />
                Watches
              </TabsTrigger>
              <TabsTrigger value="summary" data-testid="tab-summary">
                <FileText className="h-4 w-4 mr-2" />
                Summary
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hourly" className="space-y-4">
              <HourlyTab e={e} />
            </TabsContent>
            <TabsContent value="generators" className="space-y-4">
              <GeneratorsTab e={e} />
            </TabsContent>
            <TabsContent value="events" className="space-y-4">
              <EventsTab e={e} />
            </TabsContent>
            <TabsContent value="watches" className="space-y-4">
              <WatchesTab e={e} />
            </TabsContent>
            <TabsContent value="summary" className="space-y-4">
              <SummaryTab e={e} />
            </TabsContent>
          </Tabs>
        )}

        <SignOffFooter e={e} />
      </div>
    </div>
  );
}
