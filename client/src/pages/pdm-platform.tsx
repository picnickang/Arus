import { Suspense, lazy, useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IntelligenceLayout } from "@/components/intelligence/IntelligenceLayout";
import { Loader2 } from "lucide-react";
import {
  Database,
  BarChart3,
  Box,
  Zap,
  AlertTriangle,
  BrainCircuit,
  FlaskConical,
  Shield,
  CalendarClock,
  Stethoscope,
} from "lucide-react";
import { SummaryDashboard } from "./pdm-platform/SummaryDashboard";
import { FeatureStoreTab } from "./pdm-platform/FeatureStoreTab";
import { FleetAnalyticsTab } from "./pdm-platform/FleetAnalyticsTab";
import { ModelRegistryTab } from "./pdm-platform/ModelRegistryTab";
import { TrainingPipelineTab } from "./pdm-platform/TrainingPipelineTab";
import { InferenceTab } from "./pdm-platform/InferenceTab";
import { DriftMonitoringTab } from "./pdm-platform/DriftMonitoringTab";
import { GovernanceTab } from "./pdm-platform/GovernanceTab";
import { DecisionSupportTab } from "./pdm-platform/DecisionSupportTab";

const ScheduleView = lazy(() => import("@/features/pdm/components/schedule-view"));
const PdmDiagnostics = lazy(() => import("@/pages/pdm-pack"));

const VALID_TABS = [
  "features",
  "fleet",
  "models",
  "training",
  "inference",
  "drift",
  "governance",
  "decision-support",
  "schedule",
  "diagnostics",
] as const;

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
    </div>
  );
}

export default function PdmPlatformPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("features");
  const [highlightedModelVersionId, setHighlightedModelVersionId] = useState<string | null>(null);

  useEffect(() => {
    const tab = new URLSearchParams(search).get("tab");
    if (tab && (VALID_TABS as readonly string[]).includes(tab)) {
      setActiveTab(tab);
    }
  }, [search]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(search);
    params.set("tab", tab);
    setLocation(`/pdm-platform?${params.toString()}`, { replace: true });
  };

  const handleSwitchToModels = (modelVersionId: string) => {
    setHighlightedModelVersionId(modelVersionId);
    handleTabChange("models");
  };

  return (
    <IntelligenceLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <p className="text-xs text-slate-500">
          Manage predictive models, monitor fleet equipment health, review inference results, and
          govern maintenance decisions
        </p>

        <SummaryDashboard />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="schedule" data-testid="tab-schedule">
              <CalendarClock className="w-4 h-4 mr-1" /> Schedule
            </TabsTrigger>
            <TabsTrigger value="diagnostics" data-testid="tab-diagnostics">
              <Stethoscope className="w-4 h-4 mr-1" /> Diagnostics
            </TabsTrigger>
            <TabsTrigger value="features" data-testid="tab-features">
              <Database className="w-4 h-4 mr-1" /> Features
            </TabsTrigger>
            <TabsTrigger value="fleet" data-testid="tab-fleet">
              <BarChart3 className="w-4 h-4 mr-1" /> Fleet
            </TabsTrigger>
            <TabsTrigger value="models" data-testid="tab-models">
              <Box className="w-4 h-4 mr-1" /> Models
            </TabsTrigger>
            <TabsTrigger value="training" data-testid="tab-training">
              <FlaskConical className="w-4 h-4 mr-1" /> Training
            </TabsTrigger>
            <TabsTrigger value="inference" data-testid="tab-inference">
              <Zap className="w-4 h-4 mr-1" /> Inference
            </TabsTrigger>
            <TabsTrigger value="drift" data-testid="tab-drift">
              <AlertTriangle className="w-4 h-4 mr-1" /> Drift
            </TabsTrigger>
            <TabsTrigger value="governance" data-testid="tab-governance">
              <Shield className="w-4 h-4 mr-1" /> Governance
            </TabsTrigger>
            <TabsTrigger value="decision-support" data-testid="tab-decision-support">
              <BrainCircuit className="w-4 h-4 mr-1" /> Decisions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <ScheduleView />
            </Suspense>
          </TabsContent>
          <TabsContent value="diagnostics" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <PdmDiagnostics />
            </Suspense>
          </TabsContent>
          <TabsContent value="features" className="mt-4">
            <FeatureStoreTab />
          </TabsContent>
          <TabsContent value="fleet" className="mt-4">
            <FleetAnalyticsTab />
          </TabsContent>
          <TabsContent value="models" className="mt-4">
            <ModelRegistryTab highlightedVersionId={highlightedModelVersionId} />
          </TabsContent>
          <TabsContent value="training" className="mt-4">
            <TrainingPipelineTab />
          </TabsContent>
          <TabsContent value="inference" className="mt-4">
            <InferenceTab />
          </TabsContent>
          <TabsContent value="drift" className="mt-4">
            <DriftMonitoringTab />
          </TabsContent>
          <TabsContent value="governance" className="mt-4">
            <GovernanceTab onSwitchToModels={handleSwitchToModels} />
          </TabsContent>
          <TabsContent value="decision-support" className="mt-4">
            <DecisionSupportTab />
          </TabsContent>
        </Tabs>
      </div>
    </IntelligenceLayout>
  );
}
