import type { ModelDriftMetric } from "@shared/schema";

export interface ModelMonitoringPort {
  computeDrift(orgId: string, modelVersionId: string, windowDays?: number): Promise<ModelDriftMetric[]>;
  getDrift(orgId: string, modelVersionId: string): Promise<ModelDriftMetric[]>;
}
