/**
 * Equipment Context Types - Interfaces and schemas
 */

import { z } from 'zod';

export interface EquipmentContext {
  equipment: {
    id: string;
    name: string;
    type: string;
    vesselId: string | null;
    status: string;
    lastMaintenanceDate: Date | null;
    nextMaintenanceDate: Date | null;
    runningHours: number | null;
    manufacturer: string | null;
    model: string | null;
    serialNumber: string | null;
    installationDate: Date | null;
  } | null;
  
  telemetry: {
    latest: any[];
    summary: {
      readingsCount: number;
      timeRange: { start: Date; end: Date } | null;
      sensorTypes: string[];
    };
  };
  
  alerts: {
    active: any[];
    recentResolved: any[];
    summary: {
      criticalCount: number;
      warningCount: number;
      infoCount: number;
    };
  };
  
  predictions: {
    latestRul: {
      remainingUsefulLife: number | null;
      failureProbability: number | null;
      predictedFailureDate: Date | null;
      confidence: number | null;
      modelType: string | null;
    } | null;
    pdmScore: {
      score: number | null;
      trend: 'improving' | 'stable' | 'declining' | null;
      lastUpdated: Date | null;
    } | null;
  };
  
  maintenance: {
    openWorkOrders: any[];
    upcomingSchedules: any[];
    recentCompletedWorkOrders: any[];
    summary: {
      openCount: number;
      scheduledCount: number;
      overdueCount: number;
    };
  };
  
  sensors: {
    configurations: any[];
    summary: {
      totalSensors: number;
      activeSensors: number;
      sensorTypes: string[];
    };
  };
  
  knowledge: {
    relatedDocuments: any[];
    semanticMatches: any[];
  };
  
  insights: {
    active: any[];
    summary: {
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
    };
  };
  
  metadata: {
    generatedAt: Date;
    orgId: string;
    equipmentId: string;
    dataCompleteness: {
      hasTelemetry: boolean;
      hasAlerts: boolean;
      hasPredictions: boolean;
      hasMaintenance: boolean;
      hasSensors: boolean;
      hasKnowledge: boolean;
    };
  };
}

export const contextQuerySchema = z.object({
  orgId: z.string().min(1),
  includeTelemetry: z.enum(['true', 'false']).optional().default('true'),
  includeAlerts: z.enum(['true', 'false']).optional().default('true'),
  includePredictions: z.enum(['true', 'false']).optional().default('true'),
  includeMaintenance: z.enum(['true', 'false']).optional().default('true'),
  includeSensors: z.enum(['true', 'false']).optional().default('true'),
  includeKnowledge: z.enum(['true', 'false']).optional().default('true'),
  includeInsights: z.enum(['true', 'false']).optional().default('true'),
  telemetryLimit: z.coerce.number().min(1).max(500).optional().default(50),
  alertsLimit: z.coerce.number().min(1).max(100).optional().default(20),
  timeframeDays: z.coerce.number().min(1).max(365).optional().default(30),
});

export type ContextQueryOptions = z.infer<typeof contextQuerySchema>;
