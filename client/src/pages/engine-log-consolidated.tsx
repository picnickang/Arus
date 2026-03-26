import { Suspense, lazy, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cog, Fuel } from "lucide-react";

const EngineLogbook = lazy(() => import("./engine-logbook"));
const FuelEmissionsLog = lazy(() => import("./fuel-emissions-log"));

const Loading = () => <div className="flex items-center justify-center p-12 text-muted-foreground">Loading...</div>;

export default function EngineLogConsolidated() {
  const [tab, setTab] = useState("engine");

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="engine" data-testid="tab-engine-logbook"><Cog className="h-4 w-4 mr-2" />Engine Room</TabsTrigger>
        <TabsTrigger value="fuel" data-testid="tab-fuel-emissions"><Fuel className="h-4 w-4 mr-2" />Fuel & Emissions</TabsTrigger>
      </TabsList>
      <TabsContent value="engine">
        <Suspense fallback={<Loading />}><EngineLogbook /></Suspense>
      </TabsContent>
      <TabsContent value="fuel">
        <Suspense fallback={<Loading />}><FuelEmissionsLog /></Suspense>
      </TabsContent>
    </Tabs>
  );
}
