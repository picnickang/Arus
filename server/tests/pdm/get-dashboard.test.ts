import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { PdmRepositoryPort, VesselBasic } from "../../pdm/ports/pdm-repository.port";
import { createGetDashboardUseCase } from "../../pdm/application/get-dashboard.use-case";
import type {
  AssetDetail,
  FleetHealthKpis,
  RiskQueueItem,
  TelemetryCoverage,
  ModelHealth,
  MaintenancePipeline,
} from "../../pdm/domain/types";

describe("PdM Dashboard Use Cases", () => {
  let mockRepository: jest.Mocked<PdmRepositoryPort>;
  const testOrgId = "test-org-id";

  const mockKpis: FleetHealthKpis = {
    fleetHealthScore: 87.5,
    fleetHealthChange: 3.2,
    fleetHealthPeriod: "last week",
    activeAlertsTotal: 12,
    criticalAlertsCount: 3,
    assetsAtRisk: 5,
    assetsRulUnder14Days: 4,
    avoidedDowntimeHours: 156.5,
    avoidedDowntimePeriod: "Last 30 Days",
    maintenanceForecastCost: 45000,
    maintenanceForecastPeriod: "Next 30 Days",
  };

  const mockRiskItem: RiskQueueItem = {
    id: "1",
    vesselId: "vessel-1",
    vesselName: "MV Test Ship",
    equipmentId: "eq-1",
    equipmentName: "Main Engine",
    equipmentType: "Engine",
    failureMode: "Bearing Wear",
    severity: "high",
    rulEstimateDays: 10,
    rulConfidenceInterval: { lowDays: 8, highDays: 14 },
    confidence: 85,
    recommendedAction: "Schedule inspection",
    status: "active",
    detectedAt: new Date(),
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    workOrderId: null,
  };

  const mockTelemetryCoverage: TelemetryCoverage = {
    onlineCount: 18,
    totalCount: 21,
    delayedCount: 3,
    delayedEquipment: [],
  };

  const mockModelHealth: ModelHealth = {
    activeModelsCount: 8,
    driftAlertsCount: 1,
    lastTrainingDate: new Date(),
  };

  const mockMaintenancePipeline: MaintenancePipeline = {
    openWorkOrdersCount: 15,
    awaitingApprovalCount: 4,
    inProgressCount: 6,
  };

  beforeEach(() => {
    mockRepository = {
      getFleetHealthKpis: jest.fn<() => Promise<FleetHealthKpis>>().mockResolvedValue(mockKpis),
      getRiskQueue: jest
        .fn<(orgId: string, status?: string) => Promise<RiskQueueItem[]>>()
        .mockImplementation(async (_orgId, status) => {
          if (status === "active") {
            return [mockRiskItem];
          }
          if (status === "resolved") {
            return [];
          }
          return [{ ...mockRiskItem, status: "new", severity: "medium" }];
        }),
      getTelemetryCoverage: jest
        .fn<() => Promise<TelemetryCoverage>>()
        .mockResolvedValue(mockTelemetryCoverage),
      getModelHealth: jest.fn<() => Promise<ModelHealth>>().mockResolvedValue(mockModelHealth),
      getMaintenancePipeline: jest
        .fn<() => Promise<MaintenancePipeline>>()
        .mockResolvedValue(mockMaintenancePipeline),
      getAssetDetail: jest.fn<() => Promise<AssetDetail | null>>().mockResolvedValue(null),
      acknowledgeRiskItem: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      createWorkOrderFromRisk: jest.fn<() => Promise<string>>().mockResolvedValue("wo-123"),
      getActiveAlerts: jest.fn<() => Promise<RiskQueueItem[]>>().mockResolvedValue([]),
      getVessels: jest.fn<() => Promise<VesselBasic[]>>().mockResolvedValue([]),
      getEquipmentTypes: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),
    };
  });

  describe("GetDashboardUseCase", () => {
    it("should aggregate all dashboard data correctly", async () => {
      const useCase = createGetDashboardUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.kpis).toEqual(mockKpis);
      expect(result.riskQueue.active).toHaveLength(1);
      expect(result.riskQueue.resolved).toHaveLength(0);
      expect(result.telemetryCoverage).toEqual(mockTelemetryCoverage);
      expect(result.modelHealth).toEqual(mockModelHealth);
      expect(result.maintenancePipeline).toEqual(mockMaintenancePipeline);
    });

    it("should call repository with correct orgId", async () => {
      const useCase = createGetDashboardUseCase(mockRepository);
      await useCase.execute({ orgId: testOrgId });

      expect(mockRepository.getFleetHealthKpis).toHaveBeenCalledWith(testOrgId);
      expect(mockRepository.getRiskQueue).toHaveBeenCalledWith(testOrgId, "new");
      expect(mockRepository.getRiskQueue).toHaveBeenCalledWith(testOrgId, "active");
      expect(mockRepository.getRiskQueue).toHaveBeenCalledWith(testOrgId, "resolved");
      expect(mockRepository.getTelemetryCoverage).toHaveBeenCalledWith(testOrgId);
      expect(mockRepository.getModelHealth).toHaveBeenCalledWith(testOrgId);
      expect(mockRepository.getMaintenancePipeline).toHaveBeenCalledWith(testOrgId);
    });

    it("should make all repository calls in parallel", async () => {
      const callOrder: string[] = [];

      mockRepository.getFleetHealthKpis = jest
        .fn<() => Promise<FleetHealthKpis>>()
        .mockImplementation(async () => {
          callOrder.push("kpis-start");
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push("kpis-end");
          return mockKpis;
        });

      mockRepository.getTelemetryCoverage = jest
        .fn<() => Promise<TelemetryCoverage>>()
        .mockImplementation(async () => {
          callOrder.push("telemetry-start");
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push("telemetry-end");
          return mockTelemetryCoverage;
        });

      const useCase = createGetDashboardUseCase(mockRepository);
      await useCase.execute({ orgId: testOrgId });

      expect(callOrder[0]).toBe("kpis-start");
      expect(callOrder[1]).toBe("telemetry-start");
    });
  });

  describe("FleetHealthKpis Calculation", () => {
    it("should handle zero predictions gracefully", async () => {
      const emptyKpis: FleetHealthKpis = {
        ...mockKpis,
        activeAlertsTotal: 0,
        criticalAlertsCount: 0,
        assetsAtRisk: 0,
        assetsRulUnder14Days: 0,
      };
      mockRepository.getFleetHealthKpis.mockResolvedValue(emptyKpis);

      const useCase = createGetDashboardUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.kpis.activeAlertsTotal).toBe(0);
      expect(result.kpis.criticalAlertsCount).toBe(0);
      expect(result.kpis.fleetHealthScore).toBeDefined();
    });

    it("should include downtime cost calculation in maintenance forecast", async () => {
      const kpisWithCost: FleetHealthKpis = {
        ...mockKpis,
        maintenanceForecastCost: 85000,
      };
      mockRepository.getFleetHealthKpis.mockResolvedValue(kpisWithCost);

      const useCase = createGetDashboardUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.kpis.maintenanceForecastCost).toBe(85000);
      expect(result.kpis.maintenanceForecastCost).toBeGreaterThan(0);
    });

    it("should calculate fleet health score within valid range", async () => {
      const useCase = createGetDashboardUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.kpis.fleetHealthScore).toBeGreaterThanOrEqual(0);
      expect(result.kpis.fleetHealthScore).toBeLessThanOrEqual(100);
    });

    it("should track avoided downtime hours correctly", async () => {
      const kpisWithDowntime: FleetHealthKpis = {
        ...mockKpis,
        avoidedDowntimeHours: 250.5,
        avoidedDowntimePeriod: "Last 30 Days",
      };
      mockRepository.getFleetHealthKpis.mockResolvedValue(kpisWithDowntime);

      const useCase = createGetDashboardUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.kpis.avoidedDowntimeHours).toBe(250.5);
      expect(result.kpis.avoidedDowntimePeriod).toBe("Last 30 Days");
    });
  });

  describe("RiskQueue Filtering", () => {
    it("should separate risk queue items by status", async () => {
      const useCase = createGetDashboardUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.riskQueue.new).toBeDefined();
      expect(result.riskQueue.active).toBeDefined();
      expect(result.riskQueue.resolved).toBeDefined();
    });

    it("should include confidence interval in risk queue items", async () => {
      const useCase = createGetDashboardUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      const activeItem = result.riskQueue.active[0];
      expect(activeItem.rulConfidenceInterval).toBeDefined();
      expect(activeItem.rulConfidenceInterval?.lowDays).toBe(8);
      expect(activeItem.rulConfidenceInterval?.highDays).toBe(14);
    });

    it("should handle items without confidence interval", async () => {
      const itemWithoutCI: RiskQueueItem = {
        ...mockRiskItem,
        rulConfidenceInterval: null,
      };
      mockRepository.getRiskQueue.mockResolvedValue([itemWithoutCI]);

      const useCase = createGetDashboardUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.riskQueue.active[0].rulConfidenceInterval).toBeNull();
    });
  });

  describe("Telemetry Coverage", () => {
    it("should return correct online/total counts", async () => {
      const useCase = createGetDashboardUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.telemetryCoverage.onlineCount).toBe(18);
      expect(result.telemetryCoverage.totalCount).toBe(21);
      expect(result.telemetryCoverage.delayedCount).toBe(3);
    });

    it("should handle empty delayed equipment list", async () => {
      const useCase = createGetDashboardUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.telemetryCoverage.delayedEquipment).toEqual([]);
    });
  });

  describe("Model Health", () => {
    it("should track active models and drift alerts", async () => {
      const useCase = createGetDashboardUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.modelHealth.activeModelsCount).toBe(8);
      expect(result.modelHealth.driftAlertsCount).toBe(1);
    });

    it("should handle null training date", async () => {
      const healthWithNullDate: ModelHealth = {
        ...mockModelHealth,
        lastTrainingDate: null,
      };
      mockRepository.getModelHealth.mockResolvedValue(healthWithNullDate);

      const useCase = createGetDashboardUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.modelHealth.lastTrainingDate).toBeNull();
    });
  });

  describe("Maintenance Pipeline", () => {
    it("should track work order counts by status", async () => {
      const useCase = createGetDashboardUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.maintenancePipeline.openWorkOrdersCount).toBe(15);
      expect(result.maintenancePipeline.awaitingApprovalCount).toBe(4);
      expect(result.maintenancePipeline.inProgressCount).toBe(6);
    });
  });
});
