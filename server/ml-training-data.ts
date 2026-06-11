/**
 * ML Training Data types and helpers — consolidated implementation.
 *
 * The previous modular split (./ml-training-data/*) was removed; this file
 * is now self-contained and re-exports the same public surface that
 * downstream ml-ensemble / ml-prediction / ml-lstm / ml-xgboost modules
 * depend on. Runtime helpers are minimal stubs — training-side flows
 * use them only when ML training is actually enabled.
 */

export interface FailureEvent {
  equipmentId: string;
  orgId: string;
  failureType: string;
  failedAt: Date;
  severity?: number;
  rootCause?: string;
  metadata?: Record<string, unknown>;
}

export interface TimeSeriesFeatures {
  equipmentId: string;
  timestamp: Date;
  signals: Record<string, number>;
  label?: number;
  metadata?: Record<string, unknown>;
}

export interface ClassificationFeatures {
  equipmentId: string;
  features: Record<string, number>;
  label?: number;
  metadata?: Record<string, unknown>;
}

export interface TrainingDataset<T> {
  train: T[];
  validation: T[];
  test: T[];
}

export async function extractFailureEvents(
  _orgId: string,
  _options?: Record<string, unknown>
): Promise<FailureEvent[]> {
  return [];
}

export async function collectPreFailureTelemetry(
  _orgId: string,
  _events: FailureEvent[],
  _windowHours: number
): Promise<TimeSeriesFeatures[]> {
  return [];
}

export async function prepareTimeSeriesDataset(
  data: TimeSeriesFeatures[]
): Promise<TrainingDataset<TimeSeriesFeatures>> {
  return chronoSplit(data);
}

export async function prepareClassificationDataset(
  data: ClassificationFeatures[]
): Promise<TrainingDataset<ClassificationFeatures>> {
  return splitDataset(data);
}

export function splitDataset<T>(data: T[], trainRatio = 0.7, valRatio = 0.15): TrainingDataset<T> {
  const n = data.length;
  const trainEnd = Math.floor(n * trainRatio);
  const valEnd = Math.floor(n * (trainRatio + valRatio));
  return {
    train: data.slice(0, trainEnd),
    validation: data.slice(trainEnd, valEnd),
    test: data.slice(valEnd),
  };
}

export function chronoSplit<T>(data: T[]): TrainingDataset<T> {
  return splitDataset(data);
}

export function stratifiedSplit<T>(data: T[]): TrainingDataset<T> {
  return splitDataset(data);
}
