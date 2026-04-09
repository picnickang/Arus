/**
 * Cost Savings Engine Types
 */

export interface SavingsCalculation {
  workOrderId: string;
  equipmentId: string;
  vesselId: string | null;
  predictionId: number | null;

  actualCost: number;
  actualLaborCost: number;
  actualPartsCost: number;
  actualDowntimeHours: number;

  avoidedCost: number;
  emergencyLaborCost: number;
  emergencyPartsCost: number;
  emergencyDowntimeHours: number;
  emergencyDowntimeCost: number;

  totalSavings: number;
  laborSavings: number;
  partsSavings: number;
  downtimeSavings: number;

  maintenanceType: "preventive" | "predictive" | "corrective" | "emergency";
  triggeredBy: "ml_prediction" | "sensor_alert" | "scheduled" | "manual";
  confidenceScore: number | null;

  emergencyLaborMultiplier: number;
  emergencyPartsMultiplier: number;
  downtimeCostPerHour: number;
}

export interface SavingsSummary {
  totalSavings: number;
  totalDowntimePrevented: number;
  savingsByType: {
    labor: number;
    parts: number;
    downtime: number;
  };
  savingsCount: number;
  avgSavingsPerIncident: number;
  topSavings: Array<{
    workOrderId: string;
    equipmentName: string;
    savings: number;
    downtimePrevented: number;
    validationStatus: string;
  }>;
  disputedCount: number;
  voidedCount: number;
  disputedAmount: number;
  voidedAmount: number;
  confidenceRange: {
    low: number;
    high: number;
    avgConfidence: number;
  };
}
