import type { useModelPerformanceData } from "@/features/ml-ai";

export type PerformanceTabModel = ReturnType<typeof useModelPerformanceData>;

export interface ExpandedPerformanceSections {
  drift: boolean;
  equipment: boolean;
  features: boolean;
  explainability: boolean;
  marine: boolean;
  validations: boolean;
}
