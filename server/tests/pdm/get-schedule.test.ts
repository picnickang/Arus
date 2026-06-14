import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { PdmRepositoryPort, VesselBasic } from "../../pdm/ports/pdm-repository.port";
import {
  createGetScheduleUseCase,
  computeBufferDays,
  computeSchedulingWindow,
  determineBlockStatus,
} from "../../pdm/application/get-schedule.use-case";
import type { RiskQueueItem } from "../../pdm/domain/types";
import { createMockAlert, createMockTask } from "./get-schedule-test-helpers";

describe("PdM Schedule Use Cases", () => {
  let mockRepository: jest.Mocked<PdmRepositoryPort>;
  const testOrgId = "test-org-id";

  const mockVessels: VesselBasic[] = [
    { id: "vessel-1", name: "MV Atlantic Voyager" },
    { id: "vessel-2", name: "MV Pacific Star" },
  ];

  beforeEach(() => {
    mockRepository = {
      getFleetHealthKpis: jest.fn(),
      getRiskQueue: jest.fn(),
      getTelemetryCoverage: jest.fn(),
      getModelHealth: jest.fn(),
      getMaintenancePipeline: jest.fn(),
      getAssetDetail: jest.fn(),
      acknowledgeRiskItem: jest.fn(),
      createWorkOrderFromRisk: jest.fn(),
      getActiveAlerts: jest
        .fn<
          (
            orgId: string,
            vesselIds?: string[],
            equipmentTypes?: string[]
          ) => Promise<RiskQueueItem[]>
        >()
        .mockResolvedValue([]),
      getVessels: jest
        .fn<(orgId: string) => Promise<VesselBasic[]>>()
        .mockResolvedValue(mockVessels),
      getEquipmentTypes: jest
        .fn<(orgId: string) => Promise<string[]>>()
        .mockResolvedValue(["Engine", "Pump", "Generator"]),
    } as jest.Mocked<PdmRepositoryPort>;
  });

  describe("computeSchedulingWindow", () => {
    it("should compute scheduling window from RUL estimates", async () => {
      const alert = createMockAlert({
        rulEstimateDays: 14,
        rulConfidenceInterval: { lowDays: 10, highDays: 21 },
      });
      mockRepository.getActiveAlerts.mockResolvedValue([alert]);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.data.scheduledTasks).toHaveLength(1);
      const task = result.data.scheduledTasks[0];

      expect(task.rulP10Days).toBe(10);
      expect(task.rulP50Days).toBe(14);
      expect(task.rulP90Days).toBe(21);
      expect(task.schedulingWindow).toBeDefined();
      expect(task.schedulingWindow.earliestStart).toBeInstanceOf(Date);
      expect(task.schedulingWindow.preferredDate).toBeInstanceOf(Date);
      expect(task.schedulingWindow.latestFinish).toBeInstanceOf(Date);
    });

    it("should apply prep time buffer to earliest start", async () => {
      const today = new Date();
      const alert = createMockAlert({
        rulEstimateDays: 5,
        rulConfidenceInterval: { lowDays: 3, highDays: 8 },
      });
      mockRepository.getActiveAlerts.mockResolvedValue([alert]);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      const task = result.data.scheduledTasks[0];
      const diffDays = Math.round(
        (task.schedulingWindow.earliestStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDays).toBeGreaterThanOrEqual(1);
    });

    it("should handle missing confidence interval by using defaults", async () => {
      const alert = createMockAlert({
        rulEstimateDays: 10,
        rulConfidenceInterval: null,
      });
      mockRepository.getActiveAlerts.mockResolvedValue([alert]);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.data.scheduledTasks).toHaveLength(1);
      const task = result.data.scheduledTasks[0];
      expect(task.rulP50Days).toBe(10);
      expect(task.rulP90Days).toBe(15);
    });
  });

  describe("determineBlockStatus", () => {
    it("should block tasks with insufficient confidence", async () => {
      const alert = createMockAlert({
        confidence: 40,
      });
      mockRepository.getActiveAlerts.mockResolvedValue([alert]);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.data.blockedTasks).toHaveLength(1);
      expect(result.data.scheduledTasks).toHaveLength(0);
      expect(result.data.blockedTasks[0].blockReason).toBe("insufficient_confidence");
    });

    it("should block tasks when vessel hours capacity exceeded (8h/day with 4h tasks)", async () => {
      const alert1 = createMockAlert({
        id: "1",
        equipmentId: "eq-1",
        equipmentName: "Main Engine",
        rulEstimateDays: 10,
        rulConfidenceInterval: { lowDays: 8, highDays: 14 },
        confidence: 80,
      });
      const alert2 = createMockAlert({
        id: "2",
        equipmentId: "eq-2",
        equipmentName: "Generator",
        rulEstimateDays: 10,
        rulConfidenceInterval: { lowDays: 8, highDays: 14 },
        confidence: 80,
      });
      const alert3 = createMockAlert({
        id: "3",
        equipmentId: "eq-3",
        equipmentName: "Hydraulic System",
        rulEstimateDays: 10,
        rulConfidenceInterval: { lowDays: 8, highDays: 14 },
        confidence: 80,
      });
      mockRepository.getActiveAlerts.mockResolvedValue([alert1, alert2, alert3]);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.data.scheduledTasks).toHaveLength(2);
      expect(result.data.blockedTasks).toHaveLength(1);
      expect(result.data.blockedTasks[0].blockReason).toBe("capacity");
      expect(result.data.blockedTasks[0].blockDetails).toContain("8h/day limit");
    });

    it("should schedule tasks on different vessels on same date", async () => {
      const alert1 = createMockAlert({
        id: "1",
        vesselId: "vessel-1",
        vesselName: "MV Atlantic Voyager",
        rulEstimateDays: 10,
        rulConfidenceInterval: { lowDays: 8, highDays: 14 },
        confidence: 80,
      });
      const alert2 = createMockAlert({
        id: "2",
        vesselId: "vessel-2",
        vesselName: "MV Pacific Star",
        equipmentId: "eq-2",
        equipmentName: "Generator",
        rulEstimateDays: 10,
        rulConfidenceInterval: { lowDays: 8, highDays: 14 },
        confidence: 80,
      });
      mockRepository.getActiveAlerts.mockResolvedValue([alert1, alert2]);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.data.scheduledTasks).toHaveLength(2);
      expect(result.data.blockedTasks).toHaveLength(0);
    });
  });

  describe("greedy scheduler", () => {
    it("should sort scheduled tasks by preferred date", async () => {
      const alerts = [
        createMockAlert({
          id: "1",
          rulEstimateDays: 20,
          rulConfidenceInterval: { lowDays: 15, highDays: 25 },
          confidence: 80,
          vesselId: "vessel-1",
        }),
        createMockAlert({
          id: "2",
          rulEstimateDays: 5,
          rulConfidenceInterval: { lowDays: 3, highDays: 7 },
          confidence: 80,
          vesselId: "vessel-2",
        }),
        createMockAlert({
          id: "3",
          rulEstimateDays: 10,
          rulConfidenceInterval: { lowDays: 7, highDays: 14 },
          confidence: 80,
          vesselId: "vessel-3",
        }),
      ];
      mockVessels.push({ id: "vessel-3", name: "MV Indian Explorer" });
      mockRepository.getActiveAlerts.mockResolvedValue(alerts);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      const preferredDates = result.data.scheduledTasks.map(
        (t) => t.schedulingWindow.preferredDate
      );
      for (let i = 1; i < preferredDates.length; i++) {
        expect(preferredDates[i].getTime()).toBeGreaterThanOrEqual(preferredDates[i - 1].getTime());
      }
    });

    it("should sort blocked tasks by severity", async () => {
      const alerts = [
        createMockAlert({ id: "1", severity: "medium", confidence: 30, vesselId: "vessel-1" }),
        createMockAlert({ id: "2", severity: "critical", confidence: 30, vesselId: "vessel-2" }),
        createMockAlert({ id: "3", severity: "high", confidence: 30, vesselId: "vessel-3" }),
      ];
      mockVessels.push({ id: "vessel-3", name: "MV Indian Explorer" });
      mockRepository.getActiveAlerts.mockResolvedValue(alerts);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      const severities = result.data.blockedTasks.map((t) => t.severity);
      expect(severities[0]).toBe("critical");
      expect(severities[1]).toBe("high");
      expect(severities[2]).toBe("medium");
    });
  });

  describe("KPIs computation", () => {
    it("should compute schedule KPIs correctly", async () => {
      const alerts = [
        createMockAlert({ id: "1", rulEstimateDays: 5, confidence: 80, vesselId: "vessel-1" }),
        createMockAlert({ id: "2", rulEstimateDays: 7, confidence: 80, vesselId: "vessel-2" }),
        createMockAlert({ id: "3", rulEstimateDays: 21, confidence: 40, vesselId: "vessel-3" }),
      ];
      mockVessels.push({ id: "vessel-3", name: "MV Indian Explorer" });
      mockRepository.getActiveAlerts.mockResolvedValue(alerts);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.data.kpis).toBeDefined();
      expect(result.data.kpis.unassignedHighRiskCount).toBe(1);
      expect(result.data.kpis.expectedDowntimeForecastHours).toBeGreaterThanOrEqual(0);
      expect(result.data.kpis.expectedDowntimeForecastCost).toBeGreaterThanOrEqual(0);
    });

    it("should mark tasks with work orders as wo_created", async () => {
      const alert = createMockAlert({
        workOrderId: "wo-123",
        confidence: 80,
      });
      mockRepository.getActiveAlerts.mockResolvedValue([alert]);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.data.scheduledTasks).toHaveLength(1);
      expect(result.data.scheduledTasks[0].status).toBe("wo_created");
      expect(result.data.scheduledTasks[0].workOrderId).toBe("wo-123");
    });
  });

  describe("filter handling", () => {
    it("should pass filters to repository", async () => {
      const useCase = createGetScheduleUseCase(mockRepository);
      await useCase.execute({
        orgId: testOrgId,
        vesselIds: ["vessel-1"],
        equipmentTypes: ["Engine"],
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-14"),
      });

      expect(mockRepository.getActiveAlerts).toHaveBeenCalledWith(
        testOrgId,
        ["vessel-1"],
        ["Engine"]
      );
    });

    it("should return vessels list from repository", async () => {
      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: testOrgId });

      expect(result.data.vessels).toEqual(mockVessels);
      expect(mockRepository.getVessels).toHaveBeenCalledWith(testOrgId);
    });
  });

  describe("determineBlockStatus unit tests", () => {
    it("should block task when telemetry is offline", () => {
      const task = createMockTask();
      const result = determineBlockStatus(task, new Map(), 8, "offline");

      expect(result.isBlocked).toBe(true);
      expect(result.reason).toBe("telemetry_stale");
      expect(result.details).toContain("offline");
    });

    it("should not block task when telemetry is delayed (only affects buffer)", () => {
      const task = createMockTask();
      const result = determineBlockStatus(task, new Map(), 8, "delayed");

      expect(result.isBlocked).toBe(false);
    });

    it("should block task when hours capacity exceeded", () => {
      const task = createMockTask({ estimatedDowntimeHours: 4 });
      const scheduledHours = new Map<string, number>();
      const dateKey = `${task.vesselId}-${task.schedulingWindow.preferredDate.toISOString().split("T")[0]}`;
      scheduledHours.set(dateKey, 6);

      const result = determineBlockStatus(task, scheduledHours, 8, "online");

      expect(result.isBlocked).toBe(true);
      expect(result.reason).toBe("capacity");
    });
  });

  describe("computeBufferDays invariants", () => {
    it("should return base buffer of 1 day for high confidence online critical task", () => {
      const buffer = computeBufferDays({
        confidence: 90,
        telemetryFreshness: "online",
        severity: "critical",
      });
      expect(buffer).toBe(2);
    });

    it("should add buffer for null confidence", () => {
      const withConfidence = computeBufferDays({
        confidence: 90,
        telemetryFreshness: "online",
        severity: "medium",
      });
      const withoutConfidence = computeBufferDays({
        confidence: null,
        telemetryFreshness: "online",
        severity: "medium",
      });
      expect(withoutConfidence).toBeGreaterThan(withConfidence);
    });

    it("should never reduce buffer when confidence decreases", () => {
      const high = computeBufferDays({
        confidence: 90,
        telemetryFreshness: "online",
        severity: "medium",
      });
      const medium = computeBufferDays({
        confidence: 70,
        telemetryFreshness: "online",
        severity: "medium",
      });
      const low = computeBufferDays({
        confidence: 40,
        telemetryFreshness: "online",
        severity: "medium",
      });

      expect(medium).toBeGreaterThanOrEqual(high);
      expect(low).toBeGreaterThanOrEqual(medium);
    });

    it("should add buffer for delayed telemetry", () => {
      const online = computeBufferDays({
        confidence: 80,
        telemetryFreshness: "online",
        severity: "medium",
      });
      const delayed = computeBufferDays({
        confidence: 80,
        telemetryFreshness: "delayed",
        severity: "medium",
      });
      const offline = computeBufferDays({
        confidence: 80,
        telemetryFreshness: "offline",
        severity: "medium",
      });

      expect(delayed).toBeGreaterThan(online);
      expect(offline).toBeGreaterThan(online);
    });

    it("should add buffer for critical severity", () => {
      const medium = computeBufferDays({
        confidence: 80,
        telemetryFreshness: "online",
        severity: "medium",
      });
      const critical = computeBufferDays({
        confidence: 80,
        telemetryFreshness: "online",
        severity: "critical",
      });

      expect(critical).toBeGreaterThan(medium);
    });

    it("should cap buffer at maximum of 5 days", () => {
      const worstCase = computeBufferDays({
        confidence: null,
        telemetryFreshness: "offline",
        severity: "critical",
      });
      expect(worstCase).toBeLessThanOrEqual(5);
    });
  });

  describe("computeSchedulingWindow lead time blocking", () => {
    it("should detect lead time block when prep time exceeds RUL window", () => {
      const today = new Date();
      const result = computeSchedulingWindow({
        rulP10Days: 2,
        rulP50Days: 5,
        rulP90Days: 8,
        prepDays: 10,
        bufferDays: 1,
        today,
      });

      expect(result.isBlockedByLeadTime).toBe(true);
    });

    it("should not block when prep time fits within RUL window", () => {
      const today = new Date();
      const result = computeSchedulingWindow({
        rulP10Days: 7,
        rulP50Days: 14,
        rulP90Days: 21,
        prepDays: 1,
        bufferDays: 2,
        today,
      });

      expect(result.isBlockedByLeadTime).toBe(false);
      expect(result.earliestStart.getTime()).toBeLessThanOrEqual(result.latestFinish.getTime());
    });

    it("should clamp preferred date within valid window", () => {
      const today = new Date();
      const result = computeSchedulingWindow({
        rulP10Days: 5,
        rulP50Days: 10,
        rulP90Days: 15,
        prepDays: 2,
        bufferDays: 1,
        today,
      });

      expect(result.preferredDate.getTime()).toBeGreaterThanOrEqual(result.earliestStart.getTime());
      expect(result.preferredDate.getTime()).toBeLessThanOrEqual(result.latestFinish.getTime());
    });
  });
});
