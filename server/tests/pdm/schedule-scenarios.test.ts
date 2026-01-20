import { describe, it, expect, beforeEach } from '@jest/globals';
import { createGetScheduleUseCase } from '../../pdm/application/get-schedule.use-case';
import { 
  TEST_ORG_ID, 
  GOLDEN_SCENARIOS, 
  MOCK_VESSELS,
  createMockRepository 
} from './fixtures';
import type { PdmRepositoryPort } from '../../pdm/ports/pdm-repository.port';
import type { jest } from '@jest/globals';

describe('PdM Schedule Golden Scenarios', () => {
  let mockRepository: jest.Mocked<PdmRepositoryPort>;

  beforeEach(() => {
    mockRepository = createMockRepository();
  });

  describe('Case A: Schedulable High Risk Task', () => {
    it('should schedule high-risk task with adequate RUL window', async () => {
      mockRepository.getActiveAlerts.mockResolvedValue([GOLDEN_SCENARIOS.caseA_schedulableHighRisk]);
      mockRepository.getVessels.mockResolvedValue(MOCK_VESSELS);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: TEST_ORG_ID });

      expect(result.data.scheduledTasks).toHaveLength(1);
      expect(result.data.blockedTasks).toHaveLength(0);

      const task = result.data.scheduledTasks[0];
      expect(task.severity).toBe('high');
      expect(task.status).toBe('scheduled');
      expect(task.alertId).toBe('golden-a');
      expect(task.schedulingWindow.earliestStart).toBeInstanceOf(Date);
      expect(task.schedulingWindow.preferredDate).toBeInstanceOf(Date);
      expect(task.schedulingWindow.latestFinish).toBeInstanceOf(Date);
    });

    it('should compute correct scheduling window for schedulable task', async () => {
      mockRepository.getActiveAlerts.mockResolvedValue([GOLDEN_SCENARIOS.caseA_schedulableHighRisk]);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: TEST_ORG_ID });

      const task = result.data.scheduledTasks[0];
      expect(task.schedulingWindow.earliestStart.getTime())
        .toBeLessThanOrEqual(task.schedulingWindow.preferredDate.getTime());
      expect(task.schedulingWindow.preferredDate.getTime())
        .toBeLessThanOrEqual(task.schedulingWindow.latestFinish.getTime());
    });
  });

  describe('Case B: Blocked by Lead Time', () => {
    it('should block critical task when prep time exceeds RUL window', async () => {
      mockRepository.getActiveAlerts.mockResolvedValue([GOLDEN_SCENARIOS.caseB_blockedByLeadTime]);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: TEST_ORG_ID });

      expect(result.data.scheduledTasks).toHaveLength(0);
      expect(result.data.blockedTasks).toHaveLength(1);

      const blockedTask = result.data.blockedTasks[0];
      expect(blockedTask.status).toBe('blocked');
      expect(blockedTask.blockReason).toBe('scheduling_conflict');
      expect(blockedTask.blockDetails).toContain('RUL window too short');
    });

    it('should include blocked task in unassigned high risk count', async () => {
      mockRepository.getActiveAlerts.mockResolvedValue([GOLDEN_SCENARIOS.caseB_blockedByLeadTime]);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: TEST_ORG_ID });

      expect(result.data.kpis.unassignedHighRiskCount).toBe(1);
    });
  });

  describe('Case C: Capacity Constraints', () => {
    it('should respect 8h/day vessel capacity limit', async () => {
      mockRepository.getActiveAlerts.mockResolvedValue([
        GOLDEN_SCENARIOS.caseC_blockedByCapacity_task1,
        GOLDEN_SCENARIOS.caseC_blockedByCapacity_task2,
        GOLDEN_SCENARIOS.caseC_blockedByCapacity_task3,
      ]);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: TEST_ORG_ID });

      const allTasks = [...result.data.scheduledTasks, ...result.data.blockedTasks];
      expect(allTasks).toHaveLength(3);

      const vesselDayHours = new Map<string, number>();
      for (const task of result.data.scheduledTasks) {
        const key = `${task.vesselId}-${task.scheduledDate?.toISOString().split('T')[0]}`;
        const current = vesselDayHours.get(key) || 0;
        vesselDayHours.set(key, current + task.estimatedDowntimeHours);
      }

      for (const [, hours] of vesselDayHours) {
        expect(hours).toBeLessThanOrEqual(8);
      }
    });

    it('should prioritize critical severity over high when auto-populate enabled', async () => {
      mockRepository.getActiveAlerts.mockResolvedValue([
        GOLDEN_SCENARIOS.caseC_blockedByCapacity_task3,
        GOLDEN_SCENARIOS.caseC_blockedByCapacity_task1,
        GOLDEN_SCENARIOS.caseC_blockedByCapacity_task2,
      ]);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: TEST_ORG_ID, autoPopulate: true });

      const criticalTasks = result.data.scheduledTasks.filter(t => t.severity === 'critical');
      expect(criticalTasks.length).toBeGreaterThanOrEqual(1);

      if (result.data.blockedTasks.length > 0) {
        const blockedSeverities = result.data.blockedTasks.map(t => t.severity);
        const hasCriticalBlocked = blockedSeverities.includes('critical');
        const hasNonCriticalBlocked = blockedSeverities.some(s => s !== 'critical');
        if (hasNonCriticalBlocked) {
          expect(hasCriticalBlocked).toBe(false);
        }
      }
    });
  });

  describe('KPI Computation', () => {
    it('should compute accurate KPIs for mixed scenarios', async () => {
      mockRepository.getActiveAlerts.mockResolvedValue([
        GOLDEN_SCENARIOS.caseA_schedulableHighRisk,
        GOLDEN_SCENARIOS.caseB_blockedByLeadTime,
      ]);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: TEST_ORG_ID });

      const kpis = result.data.kpis;
      expect(kpis.unassignedHighRiskCount).toBe(1);
      expect(kpis.expectedDowntimeForecastHours).toBeGreaterThan(0);
      expect(kpis.expectedDowntimeForecastCost).toBeGreaterThan(0);
    });
  });

  describe('Multi-Vessel Scheduling', () => {
    it('should schedule tasks on different vessels independently', async () => {
      const vesselATask = { ...GOLDEN_SCENARIOS.caseA_schedulableHighRisk, vesselId: 'vessel-1' };
      const vesselBTask = { 
        ...GOLDEN_SCENARIOS.caseA_schedulableHighRisk, 
        id: 'golden-vessel-b',
        vesselId: 'vessel-2',
        vesselName: 'MV Pacific Star',
      };

      mockRepository.getActiveAlerts.mockResolvedValue([vesselATask, vesselBTask]);

      const useCase = createGetScheduleUseCase(mockRepository);
      const result = await useCase.execute({ orgId: TEST_ORG_ID });

      expect(result.data.scheduledTasks).toHaveLength(2);
      expect(result.data.blockedTasks).toHaveLength(0);

      const vesselIds = result.data.scheduledTasks.map(t => t.vesselId);
      expect(vesselIds).toContain('vessel-1');
      expect(vesselIds).toContain('vessel-2');
    });
  });
});
