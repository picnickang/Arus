export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  lastCheck: Date;
  metrics?: Record<string, number | string>;
}

export interface TelemetryHealthSummary {
  overall: HealthStatus;
  components: ComponentHealth[];
  timestamp: Date;
}

export interface HealthCollector {
  name: string;
  collect(): Promise<ComponentHealth>;
}
