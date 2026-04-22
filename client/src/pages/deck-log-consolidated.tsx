import { Suspense, lazy, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Book, Navigation } from "lucide-react";

const DeckLogbook = lazy(() => import("./deck-logbook"));
const VesselTrackLog = lazy(() => import("./vessel-track-log"));

const Loading = () => (
  <div className="flex items-center justify-center p-12 text-muted-foreground">Loading...</div>
);

export default function DeckLogConsolidated() {
  const [tab, setTab] = useState("logbook");

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="logbook" data-testid="tab-deck-logbook">
          <Book className="h-4 w-4 mr-2" />
          Deck Logbook
        </TabsTrigger>
        <TabsTrigger value="track" data-testid="tab-vessel-track">
          <Navigation className="h-4 w-4 mr-2" />
          Vessel Track
        </TabsTrigger>
      </TabsList>
      <TabsContent value="logbook">
        <Suspense fallback={<Loading />}>
          <DeckLogbook />
        </Suspense>
      </TabsContent>
      <TabsContent value="track">
        <Suspense fallback={<Loading />}>
          <VesselTrackLog />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
