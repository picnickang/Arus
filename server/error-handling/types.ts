/**
 * Error Handling Types and Classes
 */

export interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  successCount: number;
}

export const ERROR_HANDLING_CONFIG = {
  CIRCUIT_BREAKER: { FAILURE_THRESHOLD: 5, TIMEOUT_MS: 60000, SUCCESS_THRESHOLD: 3 },
  RETRY: { MAX_ATTEMPTS: 3, BASE_DELAY_MS: 1000, MAX_DELAY_MS: 5000, BACKOFF_MULTIPLIER: 2 },
  TIMEOUT: { DATABASE_MS: 10000, EXTERNAL_API_MS: 15000, FILE_OPERATION_MS: 5000 },
};

function getDeploymentContext(): Record<string, unknown> {
  const isLocalMode = process.env.LOCAL_MODE === "true" || process.env.EMBEDDED_MODE === "true";
  return {
    deploymentMode: isLocalMode ? "VESSEL" : "CLOUD",
    databaseType: isLocalMode ? "SQLite" : "PostgreSQL",
    environment: process.env.NODE_ENV || "development",
  };
}

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR",
    public context?: Record<string, unknown>,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = "AppError";
    this.context = { ...getDeploymentContext(), ...context };
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 400, "VALIDATION_ERROR", context);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 500, "DATABASE_ERROR", context);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 503, "EXTERNAL_SERVICE_ERROR", context);
  }
}

export class CircuitBreakerError extends AppError {
  constructor(service: string) {
    super(`Circuit breaker is open for service: ${service}`, 503, "CIRCUIT_BREAKER_OPEN", {
      service,
    });
  }
}
