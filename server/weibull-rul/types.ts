/**
 * Weibull RUL Types
 *
 * Type definitions for Weibull reliability analysis.
 */

export interface WeibullParameters {
  shape: number;
  scale: number;
  location: number;
  rsquared: number;
}

export interface RULPrediction {
  equipmentId: string;
  currentAge: number;
  predictedRUL: number;
  confidenceInterval: {
    lower: number;
    upper: number;
    level: number;
  };
  failureProbability: {
    next30days: number;
    next90days: number;
    next365days: number;
  };
  weibullParams: WeibullParameters;
  reliability: number;
  maintenanceRecommendation: "immediate" | "urgent" | "scheduled" | "routine";
}

export interface EquipmentLifeData {
  equipmentId: string;
  age: number;
  degradationMetric: number;
  maintenanceEvents: {
    timestamp: Date;
    type: "preventive" | "corrective" | "replacement";
    description: string;
  }[];
}
