/**
 * Vessel Intelligence Types
 *
 * Type definitions for vessel intelligence and historical analysis.
 */

export interface VesselPattern {
  vesselId: string;
  patternType: "failure" | "maintenance" | "operational" | "seasonal";
  description: string;
  frequency: number;
  confidence: number;
  firstObserved: Date;
  lastObserved: Date;
  affectedEquipment: string[];
  correlatedMetrics: string[];
  recommendedActions: string[];
}

export interface VesselLearnings {
  vesselId: string;
  totalOperatingHours: number;
  failurePatterns: VesselPattern[];
  maintenancePatterns: VesselPattern[];
  operationalInsights: {
    peakLoadTimes: string[];
    efficiencyTrends: {
      metric: string;
      trend: "improving" | "declining" | "stable";
      change: number;
    }[];
    environmentalFactors: {
      factor: string;
      impact: "high" | "medium" | "low";
      description: string;
    }[];
  };
  costAnalysis: {
    averageMaintenanceCost: number;
    costTrend: "increasing" | "decreasing" | "stable";
    costDrivers: { category: string; percentage: number }[];
  };
  predictiveIndicators: {
    indicator: string;
    leadTime: number;
    accuracy: number;
    description: string;
  }[];
}

export interface HistoricalContext {
  vesselId: string;
  age: number;
  totalWorkOrders: number;
  completedWorkOrders: number;
  avgResolutionTime: number;
  criticalIncidents: number;
  complianceScore: number;
  maintenanceHistory: {
    scheduled: number;
    unscheduled: number;
    emergency: number;
    preventive: number;
  };
  performanceMetrics: {
    availability: number;
    reliability: number;
    maintainability: number;
  };
  equipmentHealth: {
    critical: number;
    warning: number;
    normal: number;
    excellent: number;
  };
}
