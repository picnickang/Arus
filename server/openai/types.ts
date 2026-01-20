/**
 * OpenAI Integration Types for Marine Predictive Maintenance
 */

export interface MaintenanceInsight {
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  recommendations: string[];
  estimatedCost: number;
  urgency: "routine" | "scheduled" | "urgent" | "emergency";
  affectedSystems: string[];
  predictedFailureRisk: number;
}

export interface EquipmentAnalysis {
  equipmentId: string;
  overallHealth: number;
  insights: MaintenanceInsight[];
  summary: string;
  nextMaintenanceDate: string;
  criticalAlerts: string[];
}

export interface EquipmentRisk {
  equipmentId: string;
  failureMode: string;
  probability: number;
  impact: "Low" | "Medium" | "High" | "Critical";
  riskScore: number;
  urgency: "Immediate" | "NextPort" | "Weekly" | "Monthly";
  complianceRequirement: string;
  linkedWorkOrderId?: string;
}

export interface PrioritizedAction {
  equipmentId: string;
  action: string;
  priority: number;
  riskScore: number;
  businessImpact: "Safety" | "Compliance" | "Operational" | "Financial";
  timeWindow: string;
  resourceRequirement: string;
  linkedWorkOrderId?: string;
  complianceDeadline?: string;
}

export interface FleetBenchmarks {
  fleetAverage: {
    healthIndex: number;
    predictedDueDays: number;
    maintenanceFrequency: number;
  };
  performancePercentiles: {
    top10Percent: number;
    median: number;
    bottom10Percent: number;
  };
  bestPerformers: Array<{
    equipmentId: string;
    healthIndex: number;
    daysToMaintenance: number;
    vesselName: string;
  }>;
  worstPerformers: Array<{
    equipmentId: string;
    healthIndex: number;
    daysToMaintenance: number;
    vesselName: string;
    issuesCount: number;
  }>;
}

export interface CrossEquipmentComparison {
  equipmentId: string;
  relativePerformance: "Top25%" | "Above Average" | "Below Average" | "Bottom25%";
  fleetRanking: number;
  healthIndexVsFleetAvg: number;
  peerGroupComparison: {
    similarEquipmentCount: number;
    rankInPeerGroup: number;
    avgPeerHealth: number;
  };
  vesselComparison: {
    rankOnVessel: number;
    vesselAvgHealth: number;
    equipmentCountOnVessel: number;
  };
}

export interface FleetAnalysis {
  totalEquipment: number;
  healthyEquipment: number;
  equipmentAtRisk: number;
  criticalEquipment: number;
  topRecommendations: string[];
  costEstimate: number;
  summary: string;
  riskMatrix?: EquipmentRisk[];
  prioritizedActions?: PrioritizedAction[];
  systemIntegration?: {
    linkedWorkOrders: number;
    pendingComplianceItems: number;
    scheduledMaintenanceOverlap: number;
  };
  fleetBenchmarks?: FleetBenchmarks;
  equipmentComparisons?: CrossEquipmentComparison[];
}

export interface ErrorAnalysisResult {
  shouldRetry: boolean;
  suggestedDelay?: number;
  recommendation?: string;
  fallbackModel?: string;
}

export interface PumpAnalysisParams {
  assetId: string;
  vesselName: string;
  features: Record<string, number>;
  scores: Record<string, number>;
  severity: "info" | "warn" | "high";
  worstZ: number;
  dataSources: {
    flow: number;
    pressure: number;
    current: number;
    vibration: number;
  };
}
