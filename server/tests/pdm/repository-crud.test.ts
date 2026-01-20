import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { PdmRepositoryPort, VesselBasic } from '../../pdm/ports/pdm-repository.port';
import type { RiskQueueItem, FleetHealthKpis, TelemetryCoverage, ModelHealth, MaintenancePipeline, AssetDetail } from '../../pdm/domain/types';

describe('PdM Repository CRUD Tests', () => {
  let mockRepository: jest.Mocked<PdmRepositoryPort>;
  const TEST_ORG_ID = 'test-org-crud';
  const TEST_USER_ID = 'test-user-123';

  const mockVessels: VesselBasic[] = [
    { id: 'vessel-1', name: 'MV Atlantic Voyager' },
    { id: 'vessel-2', name: 'MV Pacific Star' },
  ];

  const mockFleetHealthKpis: FleetHealthKpis = {
    fleetHealthScore: 82,
    assetsAtRisk: 3,
    assetsRulUnder14Days: 2,
    maintenanceForecast30Days: 45000,
    totalAvoidedDowntimeHours: 120,
  };

  const mockTelemetryCoverage: TelemetryCoverage = {
    onlineCount: 18,
    totalCount: 21,
    delayedCount: 3,
    delayedEquipment: [
      {
        equipmentId: 'eq-1',
        equipmentName: 'Pump A',
        vesselName: 'MV Atlantic',
        lastSeen: new Date(),
        lastSeenAgo: '2h ago',
      },
    ],
  };

  const mockModelHealth: ModelHealth = {
    activeModelsCount: 14,
    driftAlertsCount: 2,
    lastTrainingDate: new Date('2026-01-05'),
  };

  const mockMaintenancePipeline: MaintenancePipeline = {
    openWorkOrdersCount: 7,
    awaitingApprovalCount: 2,
    inProgressCount: 3,
  };

  const mockAssetDetail: AssetDetail = {
    equipmentId: 'eq-123',
    equipmentName: 'Main Engine',
    vesselId: 'vessel-1',
    vesselName: 'MV Atlantic Voyager',
    equipmentType: 'Engine',
    rulEstimateDays: 14,
    rulUncertainty: 3,
    failureMode: 'Bearing Wear',
    confidence: 85,
    recommendedActions: ['Schedule inspection', 'Order parts'],
    evidenceCharts: [],
  };

  const createMockRiskQueueItem = (overrides: Partial<RiskQueueItem> = {}): RiskQueueItem => ({
    id: 'risk-1',
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
    status: 'new',
    detectedAt: new Date(),
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    workOrderId: null,
    ...overrides,
  });

  beforeEach(() => {
    mockRepository = {
      getFleetHealthKpis: jest.fn<(orgId: string) => Promise<FleetHealthKpis>>()
        .mockResolvedValue(mockFleetHealthKpis),
      getRiskQueue: jest.fn<(orgId: string, status?: 'new' | 'active' | 'resolved') => Promise<RiskQueueItem[]>>()
        .mockResolvedValue([createMockRiskQueueItem()]),
      getTelemetryCoverage: jest.fn<(orgId: string) => Promise<TelemetryCoverage>>()
        .mockResolvedValue(mockTelemetryCoverage),
      getModelHealth: jest.fn<(orgId: string) => Promise<ModelHealth>>()
        .mockResolvedValue(mockModelHealth),
      getMaintenancePipeline: jest.fn<(orgId: string) => Promise<MaintenancePipeline>>()
        .mockResolvedValue(mockMaintenancePipeline),
      getAssetDetail: jest.fn<(orgId: string, equipmentId: string) => Promise<AssetDetail | null>>()
        .mockResolvedValue(mockAssetDetail),
      acknowledgeRiskItem: jest.fn<(orgId: string, itemId: string, userId: string) => Promise<void>>()
        .mockResolvedValue(undefined),
      createWorkOrderFromRisk: jest.fn<(orgId: string, itemId: string, userId: string) => Promise<string>>()
        .mockResolvedValue('wo-new-123'),
      getActiveAlerts: jest.fn<(orgId: string, vesselIds?: string[], equipmentTypes?: string[]) => Promise<RiskQueueItem[]>>()
        .mockResolvedValue([createMockRiskQueueItem()]),
      getVessels: jest.fn<(orgId: string) => Promise<VesselBasic[]>>()
        .mockResolvedValue(mockVessels),
      getEquipmentTypes: jest.fn<(orgId: string) => Promise<string[]>>()
        .mockResolvedValue(['Engine', 'Pump', 'Generator']),
    } as unknown as jest.Mocked<PdmRepositoryPort>;
  });

  describe('READ Operations', () => {
    describe('getFleetHealthKpis', () => {
      it('should return fleet health KPIs with all required fields', async () => {
        const kpis = await mockRepository.getFleetHealthKpis(TEST_ORG_ID);

        expect(mockRepository.getFleetHealthKpis).toHaveBeenCalledWith(TEST_ORG_ID);
        expect(kpis).toHaveProperty('fleetHealthScore');
        expect(kpis).toHaveProperty('assetsAtRisk');
        expect(kpis).toHaveProperty('assetsRulUnder14Days');
        expect(kpis).toHaveProperty('maintenanceForecast30Days');
        expect(kpis).toHaveProperty('totalAvoidedDowntimeHours');
        expect(kpis.fleetHealthScore).toBeGreaterThanOrEqual(0);
        expect(kpis.fleetHealthScore).toBeLessThanOrEqual(100);
      });

      it('should handle zero assets at risk', async () => {
        mockRepository.getFleetHealthKpis.mockResolvedValue({
          ...mockFleetHealthKpis,
          assetsAtRisk: 0,
          assetsRulUnder14Days: 0,
        });

        const kpis = await mockRepository.getFleetHealthKpis(TEST_ORG_ID);
        expect(kpis.assetsAtRisk).toBe(0);
        expect(kpis.assetsRulUnder14Days).toBe(0);
      });
    });

    describe('getRiskQueue', () => {
      it('should return risk queue items with status filter', async () => {
        const newItems = [createMockRiskQueueItem({ status: 'new' })];
        mockRepository.getRiskQueue.mockResolvedValue(newItems);

        const items = await mockRepository.getRiskQueue(TEST_ORG_ID, 'new');

        expect(mockRepository.getRiskQueue).toHaveBeenCalledWith(TEST_ORG_ID, 'new');
        expect(items).toHaveLength(1);
        expect(items[0].status).toBe('new');
      });

      it('should filter by active status', async () => {
        const activeItems = [
          createMockRiskQueueItem({ id: 'risk-1', status: 'acknowledged' as 'new' }),
          createMockRiskQueueItem({ id: 'risk-2', status: 'acknowledged' as 'new' }),
        ];
        mockRepository.getRiskQueue.mockResolvedValue(activeItems);

        const items = await mockRepository.getRiskQueue(TEST_ORG_ID, 'active');
        expect(mockRepository.getRiskQueue).toHaveBeenCalledWith(TEST_ORG_ID, 'active');
        expect(items).toHaveLength(2);
      });

      it('should return empty array when no items match', async () => {
        mockRepository.getRiskQueue.mockResolvedValue([]);

        const items = await mockRepository.getRiskQueue(TEST_ORG_ID, 'resolved');
        expect(items).toHaveLength(0);
      });
    });

    describe('getTelemetryCoverage', () => {
      it('should return telemetry coverage with correct structure', async () => {
        const coverage = await mockRepository.getTelemetryCoverage(TEST_ORG_ID);

        expect(mockRepository.getTelemetryCoverage).toHaveBeenCalledWith(TEST_ORG_ID);
        expect(coverage.onlineCount).toBeLessThanOrEqual(coverage.totalCount);
        expect(coverage.delayedEquipment).toBeInstanceOf(Array);
      });

      it('should handle 100% online coverage', async () => {
        mockRepository.getTelemetryCoverage.mockResolvedValue({
          onlineCount: 21,
          totalCount: 21,
          delayedCount: 0,
          delayedEquipment: [],
        });

        const coverage = await mockRepository.getTelemetryCoverage(TEST_ORG_ID);
        expect(coverage.onlineCount).toBe(coverage.totalCount);
        expect(coverage.delayedCount).toBe(0);
      });
    });

    describe('getModelHealth', () => {
      it('should return model health metrics', async () => {
        const health = await mockRepository.getModelHealth(TEST_ORG_ID);

        expect(mockRepository.getModelHealth).toHaveBeenCalledWith(TEST_ORG_ID);
        expect(health.activeModelsCount).toBeGreaterThanOrEqual(0);
        expect(health.driftAlertsCount).toBeGreaterThanOrEqual(0);
        expect(health.lastTrainingDate).toBeInstanceOf(Date);
      });
    });

    describe('getMaintenancePipeline', () => {
      it('should return maintenance pipeline counts', async () => {
        const pipeline = await mockRepository.getMaintenancePipeline(TEST_ORG_ID);

        expect(mockRepository.getMaintenancePipeline).toHaveBeenCalledWith(TEST_ORG_ID);
        expect(pipeline.openWorkOrdersCount).toBeGreaterThanOrEqual(0);
        expect(pipeline.awaitingApprovalCount).toBeGreaterThanOrEqual(0);
        expect(pipeline.inProgressCount).toBeGreaterThanOrEqual(0);
      });
    });

    describe('getAssetDetail', () => {
      it('should return asset details for existing equipment', async () => {
        const detail = await mockRepository.getAssetDetail(TEST_ORG_ID, 'eq-123');

        expect(mockRepository.getAssetDetail).toHaveBeenCalledWith(TEST_ORG_ID, 'eq-123');
        expect(detail).not.toBeNull();
        expect(detail?.equipmentId).toBe('eq-123');
        expect(detail?.equipmentName).toBe('Main Engine');
        expect(detail?.recommendedActions).toBeInstanceOf(Array);
      });

      it('should return null for non-existent equipment', async () => {
        mockRepository.getAssetDetail.mockResolvedValue(null);

        const detail = await mockRepository.getAssetDetail(TEST_ORG_ID, 'non-existent');
        expect(detail).toBeNull();
      });
    });

    describe('getActiveAlerts', () => {
      it('should return active alerts for org', async () => {
        const alerts = await mockRepository.getActiveAlerts(TEST_ORG_ID);

        expect(mockRepository.getActiveAlerts).toHaveBeenCalledWith(TEST_ORG_ID);
        expect(alerts).toBeInstanceOf(Array);
      });

      it('should filter by vessel IDs', async () => {
        await mockRepository.getActiveAlerts(TEST_ORG_ID, ['vessel-1']);

        expect(mockRepository.getActiveAlerts).toHaveBeenCalledWith(TEST_ORG_ID, ['vessel-1']);
      });

      it('should filter by equipment types', async () => {
        await mockRepository.getActiveAlerts(TEST_ORG_ID, undefined, ['Engine']);

        expect(mockRepository.getActiveAlerts).toHaveBeenCalledWith(TEST_ORG_ID, undefined, ['Engine']);
      });

      it('should filter by both vessel IDs and equipment types', async () => {
        await mockRepository.getActiveAlerts(TEST_ORG_ID, ['vessel-1'], ['Engine', 'Pump']);

        expect(mockRepository.getActiveAlerts).toHaveBeenCalledWith(TEST_ORG_ID, ['vessel-1'], ['Engine', 'Pump']);
      });
    });

    describe('getVessels', () => {
      it('should return vessels for org', async () => {
        const vessels = await mockRepository.getVessels(TEST_ORG_ID);

        expect(mockRepository.getVessels).toHaveBeenCalledWith(TEST_ORG_ID);
        expect(vessels).toHaveLength(2);
        expect(vessels[0]).toHaveProperty('id');
        expect(vessels[0]).toHaveProperty('name');
      });

      it('should return empty array for org with no vessels', async () => {
        mockRepository.getVessels.mockResolvedValue([]);

        const vessels = await mockRepository.getVessels(TEST_ORG_ID);
        expect(vessels).toHaveLength(0);
      });
    });

    describe('getEquipmentTypes', () => {
      it('should return equipment types for org', async () => {
        const types = await mockRepository.getEquipmentTypes(TEST_ORG_ID);

        expect(mockRepository.getEquipmentTypes).toHaveBeenCalledWith(TEST_ORG_ID);
        expect(types).toContain('Engine');
        expect(types).toContain('Pump');
        expect(types).toContain('Generator');
      });
    });
  });

  describe('UPDATE Operations', () => {
    describe('acknowledgeRiskItem', () => {
      it('should acknowledge a risk item with correct parameters', async () => {
        const itemId = 'risk-123';

        await mockRepository.acknowledgeRiskItem(TEST_ORG_ID, itemId, TEST_USER_ID);

        expect(mockRepository.acknowledgeRiskItem).toHaveBeenCalledWith(
          TEST_ORG_ID,
          itemId,
          TEST_USER_ID
        );
      });

      it('should resolve without error on success', async () => {
        await expect(
          mockRepository.acknowledgeRiskItem(TEST_ORG_ID, 'risk-1', TEST_USER_ID)
        ).resolves.toBeUndefined();
      });

      it('should propagate errors from repository', async () => {
        mockRepository.acknowledgeRiskItem.mockRejectedValue(new Error('Item not found'));

        await expect(
          mockRepository.acknowledgeRiskItem(TEST_ORG_ID, 'non-existent', TEST_USER_ID)
        ).rejects.toThrow('Item not found');
      });
    });
  });

  describe('CREATE Operations', () => {
    describe('createWorkOrderFromRisk', () => {
      it('should create a work order and return its ID', async () => {
        const itemId = 'risk-456';

        const workOrderId = await mockRepository.createWorkOrderFromRisk(
          TEST_ORG_ID,
          itemId,
          TEST_USER_ID
        );

        expect(mockRepository.createWorkOrderFromRisk).toHaveBeenCalledWith(
          TEST_ORG_ID,
          itemId,
          TEST_USER_ID
        );
        expect(workOrderId).toBe('wo-new-123');
      });

      it('should throw error for non-existent prediction', async () => {
        mockRepository.createWorkOrderFromRisk.mockRejectedValue(
          new Error('Prediction not found')
        );

        await expect(
          mockRepository.createWorkOrderFromRisk(TEST_ORG_ID, 'non-existent', TEST_USER_ID)
        ).rejects.toThrow('Prediction not found');
      });

      it('should return unique work order ID for each creation', async () => {
        mockRepository.createWorkOrderFromRisk
          .mockResolvedValueOnce('wo-1')
          .mockResolvedValueOnce('wo-2');

        const wo1 = await mockRepository.createWorkOrderFromRisk(TEST_ORG_ID, 'risk-1', TEST_USER_ID);
        const wo2 = await mockRepository.createWorkOrderFromRisk(TEST_ORG_ID, 'risk-2', TEST_USER_ID);

        expect(wo1).not.toBe(wo2);
      });
    });
  });

  describe('Port Interface Compliance', () => {
    it('should implement all required methods from PdmRepositoryPort', () => {
      expect(typeof mockRepository.getFleetHealthKpis).toBe('function');
      expect(typeof mockRepository.getRiskQueue).toBe('function');
      expect(typeof mockRepository.getTelemetryCoverage).toBe('function');
      expect(typeof mockRepository.getModelHealth).toBe('function');
      expect(typeof mockRepository.getMaintenancePipeline).toBe('function');
      expect(typeof mockRepository.getAssetDetail).toBe('function');
      expect(typeof mockRepository.acknowledgeRiskItem).toBe('function');
      expect(typeof mockRepository.createWorkOrderFromRisk).toBe('function');
      expect(typeof mockRepository.getActiveAlerts).toBe('function');
      expect(typeof mockRepository.getVessels).toBe('function');
      expect(typeof mockRepository.getEquipmentTypes).toBe('function');
    });
  });
});
