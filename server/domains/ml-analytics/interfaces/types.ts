import type { RequestHandler } from "express";
import type { schedulerEventBus as SchedulerEventBusInstance } from "../../../events/scheduler-bus.js";

export interface MlAnalyticsConfig {
  writeOperationRateLimit: RequestHandler;
  schedulerEventBus?: typeof SchedulerEventBusInstance;
  adaptiveTrainingWindow: typeof import("../../../adaptive-training-window");
}
