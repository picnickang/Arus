import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IntelligenceLayout } from "@/components/intelligence/IntelligenceLayout";
import {
  Box,
  Activity,
  BarChart3,
  FlaskConical,
  Clock,
} from "lucide-react";






import { OverviewTab } from "./OverviewTab";
import { StateTab } from "./StateTab";
import { ResidualsTab } from "./ResidualsTab";
import { ScenariosTab } from "./ScenariosTab";
import { ReplayTab } from "./ReplayTab";

export default function DigitalTwinPage() {
  return (
    <IntelligenceLayout>
      <div className="p-4 md:p-6 space-y-6">
        <p className="text-xs text-slate-500">
          Asset-level digital twins for predictive maintenance
        </p>

        <Tabs defaultValue="overview">
          <TabsList className="flex w-full overflow-x-auto" data-testid="tabs-digital-twin">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Box className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="state" data-testid="tab-state">
              <Activity className="w-4 h-4 mr-2" />
              State
            </TabsTrigger>
            <TabsTrigger value="residuals" data-testid="tab-residuals">
              <BarChart3 className="w-4 h-4 mr-2" />
              Residuals
            </TabsTrigger>
            <TabsTrigger value="scenarios" data-testid="tab-scenarios">
              <FlaskConical className="w-4 h-4 mr-2" />
              Scenarios
            </TabsTrigger>
            <TabsTrigger value="replay" data-testid="tab-replay">
              <Clock className="w-4 h-4 mr-2" />
              Replay
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="state" className="mt-4">
            <StateTab />
          </TabsContent>
          <TabsContent value="residuals" className="mt-4">
            <ResidualsTab />
          </TabsContent>
          <TabsContent value="scenarios" className="mt-4">
            <ScenariosTab />
          </TabsContent>
          <TabsContent value="replay" className="mt-4">
            <ReplayTab />
          </TabsContent>
        </Tabs>
      </div>
    </IntelligenceLayout>
  );
}
