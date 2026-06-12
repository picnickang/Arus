/**
 * Performance Tab
 *
 * Model performance metrics, drift detection, equipment accuracy,
 * feature importance, and SHAP explainability.
 */

import { useState } from "react";
import { useModelPerformanceData } from "@/features/ml-ai";
import { PerformanceExplainabilitySection } from "./PerformanceTabExplainability";
import {
  MarineAndValidationSections,
  PerformanceDiagnosticSections,
} from "./PerformanceTabSections";
import {
  CriticalDriftAlert,
  ModelSummaryCard,
  PerformanceStatsCards,
} from "./PerformanceTabSummary";
import type { ExpandedPerformanceSections } from "./PerformanceTabTypes";

export default function PerformanceTab() {
  const m = useModelPerformanceData();
  const [expandedSections, setExpandedSections] = useState<ExpandedPerformanceSections>({
    drift: true,
    equipment: false,
    features: false,
    explainability: false,
    marine: false,
    validations: false,
  });

  const toggleSection = (section: keyof ExpandedPerformanceSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-6">
      <PerformanceStatsCards m={m} />
      <CriticalDriftAlert m={m} />
      <ModelSummaryCard m={m} />
      <PerformanceDiagnosticSections
        m={m}
        expandedSections={expandedSections}
        toggleSection={toggleSection}
      />
      <PerformanceExplainabilitySection
        expanded={expandedSections.explainability}
        onToggle={() => toggleSection("explainability")}
      />
      <MarineAndValidationSections
        m={m}
        expandedSections={expandedSections}
        toggleSection={toggleSection}
      />
    </div>
  );
}
