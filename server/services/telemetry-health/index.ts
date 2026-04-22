import type { HealthCollector, TelemetryHealthSummary, HealthStatus, ComponentHealth } from './types';
import { batchWriterHealthCollector } from './collectors/batchWriter';
import { circuitBreakerHealthCollector } from './collectors/circuitBreaker';

class TelemetryHealthAggregator {
  private collectors: HealthCollector[] = [];

  registerCollector(collector: HealthCollector): void {
    this.collectors.push(collector);
  }

  unregisterCollector(name: string): void {
    this.collectors = this.collectors.filter(c => c.name !== name);
  }

  async getHealth(): Promise<TelemetryHealthSummary> {
    const components: ComponentHealth[] = await Promise.all(
      this.collectors.map(c => c.collect())
    );

    const overall = this.computeOverallStatus(components);

    return {
      overall,
      components,
      timestamp: new Date(),
    };
  }

  private computeOverallStatus(components: ComponentHealth[]): HealthStatus {
    if (components.length === 0) {return 'unknown';}
    
    const hasUnhealthy = components.some(c => c.status === 'unhealthy');
    const hasDegraded = components.some(c => c.status === 'degraded');
    const hasUnknown = components.some(c => c.status === 'unknown');
    
    if (hasUnhealthy) {return 'unhealthy';}
    if (hasDegraded) {return 'degraded';}
    if (hasUnknown) {return 'unknown';}
    return 'healthy';
  }
}

const telemetryHealthAggregator = new TelemetryHealthAggregator();

telemetryHealthAggregator.registerCollector(batchWriterHealthCollector);
telemetryHealthAggregator.registerCollector(circuitBreakerHealthCollector);

export { telemetryHealthAggregator, batchWriterHealthCollector, circuitBreakerHealthCollector };
export * from './types';
