/**
 * ML Analytics Route Configuration Types
 */

import type { IStorage } from "../../../storage";

export interface MlAnalyticsConfig {
  storage: IStorage;
  writeOperationRateLimit: any;
  schedulerEventBus: any;
  adaptiveTrainingWindow: any;
}
