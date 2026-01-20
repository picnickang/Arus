import type { HealthCollector, ComponentHealth, HealthStatus } from '../types';
import type { CircuitBreakerMetrics, CircuitState } from '../../circuit-breaker';

interface CircuitBreakerProvider {
  getState(): CircuitState;
  getMetrics(): CircuitBreakerMetrics;
}

export class CircuitBreakerHealthCollector implements HealthCollector {
  name = 'circuit-breaker';
  private providers: Map<string, CircuitBreakerProvider> = new Map();

  registerCircuitBreaker(name: string, provider: CircuitBreakerProvider): void {
    this.providers.set(name, provider);
  }

  unregisterCircuitBreaker(name: string): void {
    this.providers.delete(name);
  }

  async collect(): Promise<ComponentHealth> {
    if (this.providers.size === 0) {
      return {
        name: this.name,
        status: 'unknown',
        message: 'No circuit breakers registered',
        lastCheck: new Date(),
      };
    }

    let status: HealthStatus = 'healthy';
    const openCircuits: string[] = [];
    const halfOpenCircuits: string[] = [];
    const metrics: Record<string, string | number> = {};

    for (const [cbName, provider] of this.providers) {
      const state = provider.getState();
      const cbMetrics = provider.getMetrics();
      
      metrics[`${cbName}_state`] = state;
      metrics[`${cbName}_failures`] = cbMetrics.totalFailures;
      
      if (state === 'OPEN') {
        openCircuits.push(cbName);
      } else if (state === 'HALF_OPEN') {
        halfOpenCircuits.push(cbName);
      }
    }

    let message = 'All circuits closed';
    if (openCircuits.length > 0) {
      status = 'unhealthy';
      message = `Open circuits: ${openCircuits.join(', ')}`;
    } else if (halfOpenCircuits.length > 0) {
      status = 'degraded';
      message = `Half-open circuits: ${halfOpenCircuits.join(', ')}`;
    }

    return {
      name: this.name,
      status,
      message,
      lastCheck: new Date(),
      metrics,
    };
  }
}

export const circuitBreakerHealthCollector = new CircuitBreakerHealthCollector();
