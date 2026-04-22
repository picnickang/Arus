import { EventEmitter } from "node:events";
import client from "prom-client";
import type { CircuitState, CircuitBreakerConfig, CircuitBreakerMetrics } from "./types";

const circuitStateGauge = new client.Gauge({
  name: "arus_circuit_breaker_state",
  help: "Circuit breaker state (0=closed, 1=open, 2=half-open)",
  labelNames: ["name"],
});

const circuitFailuresTotal = new client.Counter({
  name: "arus_circuit_breaker_failures_total",
  help: "Total circuit breaker failures",
  labelNames: ["name"],
});

const circuitSuccessesTotal = new client.Counter({
  name: "arus_circuit_breaker_successes_total",
  help: "Total circuit breaker successes",
  labelNames: ["name"],
});

const stateValues: Record<CircuitState, number> = {
  CLOSED: 0,
  OPEN: 1,
  HALF_OPEN: 2,
};

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxAttempts: 3,
  name: "default",
};

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private halfOpenAttempts = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private resetTimer: NodeJS.Timeout | null = null;
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.updateMetrics();
  }

  private updateMetrics(): void {
    circuitStateGauge.set({ name: this.config.name }, stateValues[this.state]);
  }

  private setState(newState: CircuitState): void {
    if (this.state !== newState) {
      const from = this.state;
      this.state = newState;
      this.updateMetrics();
      this.emit("stateChange", { from, to: newState, name: this.config.name });
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  isOpen(): boolean {
    return this.state === "OPEN";
  }

  isClosed(): boolean {
    return this.state === "CLOSED";
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === "OPEN") {
      throw new Error(`Circuit breaker '${this.config.name}' is OPEN`);
    }

    if (this.state === "HALF_OPEN") {
      this.halfOpenAttempts++;
      this.emit("halfOpenAttempt", {
        attempt: this.halfOpenAttempts,
        maxAttempts: this.config.halfOpenMaxAttempts,
        name: this.config.name,
      });
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    this.totalSuccesses++;
    this.lastSuccessTime = new Date();
    circuitSuccessesTotal.inc({ name: this.config.name });
    this.emit("success", { name: this.config.name });

    if (this.state === "HALF_OPEN") {
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        this.failureCount = 0;
        this.halfOpenAttempts = 0;
        this.setState("CLOSED");
      }
    } else if (this.state === "CLOSED") {
      this.failureCount = 0;
    }
  }

  private onFailure(error: Error): void {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = new Date();
    circuitFailuresTotal.inc({ name: this.config.name });
    this.emit("failure", { error, name: this.config.name });

    if (this.state === "HALF_OPEN") {
      this.halfOpenAttempts = 0;
      this.tripCircuit();
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.tripCircuit();
    }
  }

  private tripCircuit(): void {
    this.setState("OPEN");
    this.scheduleReset();
  }

  private scheduleReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.resetTimer = setTimeout(() => {
      this.halfOpenAttempts = 0;
      this.setState("HALF_OPEN");
    }, this.config.resetTimeoutMs);
  }

  reset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
    this.setState("CLOSED");
  }

  destroy(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    this.removeAllListeners();
  }
}

export function createCircuitBreaker(config: Partial<CircuitBreakerConfig> = {}): CircuitBreaker {
  return new CircuitBreaker(config);
}
