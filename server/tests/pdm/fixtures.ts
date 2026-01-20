import { jest } from '@jest/globals';
import type { RiskQueueItem, PdmScheduledTask } from '../../pdm/domain/types';
import type { PdmRepositoryPort, VesselBasic } from '../../pdm/ports/pdm-repository.port';

export const TEST_ORG_ID = 'test-org-id';
export const TEST_VESSEL_1 = { id: 'vessel-1', name: 'MV Atlantic Voyager' };
export const TEST_VESSEL_2 = { id: 'vessel-2', name: 'MV Pacific Star' };

export const FIXED_TODAY = new Date('2026-01-07T12:00:00Z');

export function createMockAlert(overrides: Partial<RiskQueueItem> = {}): RiskQueueItem {
  return {
    id: '1',
    vesselId: 'vessel-1',
    vesselName: 'MV Atlantic Voyager',
    equipmentId: 'eq-1',
    equipmentName: 'Main Engine',
    equipmentType: 'Engine',
    failureMode: 'Bearing Wear',
    severity: 'high',
    rulEstimateDays: 10,
    rulConfidenceInterval: { lowDays: 7, highDays: 14 },
    confidence: 85,
    recommendedAction: 'Schedule inspection',
    status: 'active',
    detectedAt: new Date(),
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    workOrderId: null,
    ...overrides,
  };
}

export function createMockTask(overrides: Partial<PdmScheduledTask> = {}): PdmScheduledTask {
  return {
    id: 'task-1',
    alertId: '1',
    vesselId: 'vessel-1',
    vesselName: 'MV Atlantic Voyager',
    equipmentId: 'eq-1',
    equipmentName: 'Main Engine',
    equipmentType: 'Engine',
    failureMode: 'Bearing Wear',
    severity: 'high',
    rulP10Days: 7,
    rulP50Days: 10,
    rulP90Days: 14,
    confidence: 85,
    schedulingWindow: {
      earliestStart: new Date(),
      preferredDate: new Date(),
      latestFinish: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
    estimatedDowntimeHours: 4,
    estimatedCost: 1300,
    status: 'draft',
    recommendedActions: ['Inspect bearings'],
    scheduledDate: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

export const GOLDEN_SCENARIOS = {
  caseA_schedulableHighRisk: createMockAlert({
    id: 'golden-a',
    severity: 'high',
    rulEstimateDays: 8,
    rulConfidenceInterval: { lowDays: 6, highDays: 10 },
    confidence: 85,
    equipmentName: 'Main Engine Pump',
    failureMode: 'Impeller Erosion',
  }),

  caseB_blockedByLeadTime: createMockAlert({
    id: 'golden-b',
    severity: 'critical',
    rulEstimateDays: 3,
    rulConfidenceInterval: { lowDays: 2, highDays: 4 },
    confidence: 90,
    equipmentName: 'Turbocharger',
    failureMode: 'Shaft Fatigue',
  }),

  caseC_blockedByCapacity_task1: createMockAlert({
    id: 'golden-c1',
    vesselId: 'vessel-2',
    vesselName: 'MV Pacific Star',
    severity: 'critical',
    rulEstimateDays: 8,
    rulConfidenceInterval: { lowDays: 6, highDays: 10 },
    confidence: 88,
    equipmentId: 'eq-c1',
    equipmentName: 'Generator 1',
    failureMode: 'Winding Insulation',
  }),

  caseC_blockedByCapacity_task2: createMockAlert({
    id: 'golden-c2',
    vesselId: 'vessel-2',
    vesselName: 'MV Pacific Star',
    severity: 'critical',
    rulEstimateDays: 8,
    rulConfidenceInterval: { lowDays: 6, highDays: 10 },
    confidence: 87,
    equipmentId: 'eq-c2',
    equipmentName: 'Generator 2',
    failureMode: 'Bearing Overheating',
  }),

  caseC_blockedByCapacity_task3: createMockAlert({
    id: 'golden-c3',
    vesselId: 'vessel-2',
    vesselName: 'MV Pacific Star',
    severity: 'high',
    rulEstimateDays: 8,
    rulConfidenceInterval: { lowDays: 6, highDays: 10 },
    confidence: 82,
    equipmentId: 'eq-c3',
    equipmentName: 'Cooling Pump',
    failureMode: 'Seal Leak',
  }),
};

export const MOCK_VESSELS = [TEST_VESSEL_1, TEST_VESSEL_2];

export function createMockRepository(): jest.Mocked<PdmRepositoryPort> {
  return {
    getFleetHealthKpis: jest.fn(),
    getRiskQueue: jest.fn(),
    getTelemetryCoverage: jest.fn(),
    getModelHealth: jest.fn(),
    getMaintenancePipeline: jest.fn(),
    getAssetDetail: jest.fn(),
    acknowledgeRiskItem: jest.fn(),
    createWorkOrderFromRisk: jest.fn(),
    getActiveAlerts: jest.fn<(orgId: string, vesselIds?: string[], equipmentTypes?: string[]) => Promise<RiskQueueItem[]>>()
      .mockResolvedValue([]),
    getVessels: jest.fn<(orgId: string) => Promise<VesselBasic[]>>()
      .mockResolvedValue(MOCK_VESSELS),
    getEquipmentTypes: jest.fn<(orgId: string) => Promise<string[]>>()
      .mockResolvedValue(['Engine', 'Pump', 'Generator']),
  } as unknown as jest.Mocked<PdmRepositoryPort>;
}
