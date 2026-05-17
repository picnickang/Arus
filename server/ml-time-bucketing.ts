export interface TelemetryBucket {
  timestamp: number;
  values: Record<string, number>;
  sensors: Map<string, number>;
  count: number;
}

export function bucketTelemetry(
  _data: any[],
  _options?: number | { bucketSizeMs?: number; aggregationMethod?: string }
): TelemetryBucket[] {
  return [];
}

export function getLastNBuckets(_buckets: TelemetryBucket[], _n: number): TelemetryBucket[] {
  return [];
}
