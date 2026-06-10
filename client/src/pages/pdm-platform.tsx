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
import { usePermissions } from "@/contexts/PermissionsContext";
import { SummaryDashboard } from "./pdm-platform/SummaryDashboard";
import { MlOpsTabPicker } from "./pdm-platform/MlOpsTabPicker";
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

export const VALID_TABS = [
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

// Watchkeeper-facing tabs stay in the row; ML-engineer tooling (raw
// Z-scores, μ/σ tables, training metrics) moves behind the gated picker.
// Governance stays operator-side: it is the chief engineer's prediction
// review queue, relabeled "Reviews" (tab id unchanged for deep links).
export const OPERATOR_TABS = ["schedule", "decision-support", "governance"] as const;
export const ML_OPS_TABS = [
  "models",
  "training",
  "inference",
  "drift",
  "features",
  "fleet",
  "diagnostics",
] as const;
const DEFAULT_TAB = "schedule";

const ML_OPS_TAB_DEFS = [
  { id: "models", label: "Models & versions", icon: Box },
  { id: "training", label: "Training runs", icon: FlaskConical },
  { id: "inference", label: "Inference", icon: Zap },
  { id: "drift", label: "Drift monitoring", icon: AlertTriangle },
  { id: "features", label: "Feature store", icon: Database },
  { id: "fleet", label: "Fleet baselines", icon: BarChart3 },
  { id: "diagnostics", label: "Diagnostics (Z-scores)", icon: Stethoscope },
];

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
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_TAB);
  const [highlightedModelVersionId, setHighlightedModelVersionId] = useState<string | null>(null);
  const { hasPermission, permissions } = usePermissions();
  // While permissions load, don't strip a gated deep link — permitted
  // users' ?tab= must survive first paint; denied users fall back below.
  const canMlOps = hasPermission("predictive_maintenance", "manage_config");
  const mlOpsKnown = !permissions.isLoading;

  useEffect(() => {
    const tab = new URLSearchParams(search).get("tab");
    if (tab && (VALID_TABS as readonly string[]).includes(tab)) {
      setActiveTab(tab);
    }
  }, [search]);

  useEffect(() => {
    if (mlOpsKnown && !canMlOps && (ML_OPS_TABS as readonly string[]).includes(activeTab)) {
      setActiveTab(DEFAULT_TAB);
    }
  }, [mlOpsKnown, canMlOps, activeTab]);

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
            <TabsTrigger value="decision-support" data-testid="tab-decision-support">
              <BrainCircuit className="w-4 h-4 mr-1" /> Decisions
            </TabsTrigger>
            <TabsTrigger value="governance" data-testid="tab-governance">
              <Shield className="w-4 h-4 mr-1" /> Reviews
            </TabsTrigger>
            {canMlOps && (
              <div className="ml-auto">
                <MlOpsTabPicker
                  tabs={ML_OPS_TAB_DEFS}
                  activeTab={activeTab}
                  onSelect={handleTabChange}
                />
              </div>
            )}
          </TabsList>

          <TabsContent value="schedule" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <ScheduleView />
            </Suspense>
          </TabsContent>
          <TabsContent value="governance" className="mt-4">
            <GovernanceTab onSwitchToModels={handleSwitchToModels} />
          </TabsContent>
          <TabsContent value="decision-support" className="mt-4">
            <DecisionSupportTab />
          </TabsContent>
          {(canMlOps || !mlOpsKnown) && (
            <>
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
            </>
          )}
        </Tabs>
      </div>
    </IntelligenceLayout>
  );
}
