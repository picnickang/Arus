/**
 * LP Optimizer - Types and Interfaces
 */

export interface OptimizationConstraints {
  maxDailyWorkHours: number;
  maxConcurrentJobs: number;
  crewAvailability: Array<{
    crewMember: string;
    availableDays: string[];
    maxHoursPerDay: number;
    skillLevel: number;
    hourlyRate: number;
  }>;
  partsBudget: number;
  timeHorizonDays: number;
  priorityWeights: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface MaintenanceJob {
  id: string;
  equipmentId: string;
  equipmentName: string;
  maintenanceType: string;
  priority: number;
  estimatedDuration: number;
  requiredSkillLevel: number;
  parts: Array<{
    partId: string;
    quantity: number;
    unitCost: number;
  }>;
  preferredDate?: Date;
  deadline?: Date;
  dependencies?: string[];
}

export interface OptimizationResult {
  success: boolean;
  objectiveValue: number;
  schedule: Array<{
    jobId: string;
    equipmentId: string;
    assignedCrew: string;
    scheduledDate: Date;
    startTime: string;
    duration: number;
    estimatedCost: number;
    priority: number;
  }>;
  resourceUtilization: {
    crewUtilization: Array<{
      crewMember: string;
      totalHours: number;
      utilizationRate: number;
    }>;
    dailyWorkload: Array<{
      date: string;
      totalHours: number;
      jobCount: number;
    }>;
    totalCost: number;
    partsUsedBudget: number;
  };
  constraints: {
    feasible: boolean;
    violations: string[];
  };
  optimizationTime: number;
  optimizationId?: string;
}
