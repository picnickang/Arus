import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IntelligenceLayout } from "@/components/intelligence/IntelligenceLayout";
import {
  Database,
  BarChart3,
  Box,
  Zap,
  AlertTriangle,
  BrainCircuit,
  FlaskConical,
  Shield,
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

export default function PdmPlatformPage() {
  const [activeTab, setActiveTab] = useState("features");
  const [highlightedModelVersionId, setHighlightedModelVersionId] = useState<string | null>(null);

  const handleSwitchToModels = (modelVersionId: string) => {
    setHighlightedModelVersionId(modelVersionId);
    setActiveTab("models");
  };

  return (
    <IntelligenceLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <p className="text-xs text-slate-500">
          Manage predictive models, monitor fleet equipment health, review inference results, and
          govern maintenance decisions
        </p>

        <SummaryDashboard />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full overflow-x-auto">
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
