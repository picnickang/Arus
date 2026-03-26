import { logger } from "../utils/logger";

const LOG_CTX = "RunningHourAccumulator";

const MIN_RPM_FOR_RUNNING = 50;

interface RunningHourState {
  equipmentId: string;
  orgId: string;
  totalHours: number;
  lastRpm: number;
  lastTimestamp: Date;
  isRunning: boolean;
}

class RunningHourAccumulatorService {
  private states = new Map<string, RunningHourState>();
  private storage: any = null;
  private thresholds = new Map<string, number[]>();

  setStorage(storage: any): void {
    this.storage = storage;
  }

  setThresholds(equipmentId: string, hours: number[]): void {
    this.thresholds.set(equipmentId, hours.sort((a, b) => a - b));
  }

  async processReading(
    equipmentId: string,
    orgId: string,
    rpm: number,
    timestamp: Date
  ): Promise<void> {
    const key = `${orgId}:${equipmentId}`;
    const state = this.states.get(key);

    if (!state) {
      this.states.set(key, {
        equipmentId,
        orgId,
        totalHours: 0,
        lastRpm: rpm,
        lastTimestamp: timestamp,
        isRunning: rpm >= MIN_RPM_FOR_RUNNING,
      });
      return;
    }

    const isRunning = rpm >= MIN_RPM_FOR_RUNNING;
    const timeDeltaMs = timestamp.getTime() - state.lastTimestamp.getTime();

    if (timeDeltaMs <= 0 || timeDeltaMs > 60 * 60 * 1000) {
      state.lastRpm = rpm;
      state.lastTimestamp = timestamp;
      state.isRunning = isRunning;
      return;
    }

    if (state.isRunning) {
      const deltaHours = timeDeltaMs / (1000 * 60 * 60);
      const previousHours = state.totalHours;
      state.totalHours += deltaHours;

      await this.checkThresholds(equipmentId, orgId, previousHours, state.totalHours);
    }

    state.lastRpm = rpm;
    state.lastTimestamp = timestamp;
    state.isRunning = isRunning;
  }

  private async checkThresholds(
    equipmentId: string,
    orgId: string,
    previousHours: number,
    currentHours: number
  ): Promise<void> {
    const thresholds = this.thresholds.get(equipmentId);
    if (!thresholds || !this.storage) return;

    for (const threshold of thresholds) {
      if (previousHours < threshold && currentHours >= threshold) {
        logger.info(LOG_CTX, `Running hour threshold ${threshold}h reached for ${equipmentId} (actual: ${currentHours.toFixed(1)}h)`);

        try {
          await this.storage.createWorkOrder({
            orgId,
            equipmentId,
            title: `Running hour maintenance at ${threshold}h`,
            description: `Equipment ${equipmentId} has reached ${currentHours.toFixed(0)} running hours. Scheduled maintenance is due at ${threshold} hours.`,
            type: "preventive",
            priority: threshold >= 10000 ? 1 : 2,
            status: "open",
            source: "running_hour_trigger",
            metadata: {
              triggerType: "running_hours",
              thresholdHours: threshold,
              actualHours: Math.round(currentHours),
            },
          });
        } catch (error) {
          logger.error(LOG_CTX, `Failed to create work order for ${equipmentId} at ${threshold}h`, error);
        }
      }
    }
  }

  getState(equipmentId: string, orgId: string): RunningHourState | null {
    return this.states.get(`${orgId}:${equipmentId}`) || null;
  }

  getAllStates(): RunningHourState[] {
    return [...this.states.values()];
  }
}

export const runningHourAccumulator = new RunningHourAccumulatorService();
export default RunningHourAccumulatorService;
