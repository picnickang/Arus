export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  ENTITY_NOT_FOUND: "ENTITY_NOT_FOUND",
  ORG_REQUIRED: "ORG_REQUIRED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  IDEMPOTENCY_KEY_REQUIRED: "IDEMPOTENCY_KEY_REQUIRED",
  DUPLICATE_REQUEST: "DUPLICATE_REQUEST",
  REQUEST_EXPIRED: "REQUEST_EXPIRED",
  REPLAY_PROTECTION_REQUIRED: "REPLAY_PROTECTION_REQUIRED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  CIRCUIT_OPEN: "CIRCUIT_OPEN",
  DB_TIMEOUT: "DB_TIMEOUT",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
  MODEL_NOT_FOUND: "MODEL_NOT_FOUND",
  CALIBRATION_FAILED: "CALIBRATION_FAILED",
  TRAINING_IN_PROGRESS: "TRAINING_IN_PROGRESS",
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

interface ApiErrorResponse {
  error: {
    code: ErrorCodeType;
    message: string;
    details?: unknown;
  };
  metadata: {
    timestamp: string;
    requestId?: string;
    version: string;
  };
}

export function sendApiError(
  res: any,
  status: number,
  code: ErrorCodeType,
  message: string,
  details?: unknown,
  requestId?: string
): void {
  const response: ApiErrorResponse = {
    error: {
      code,
      message,
      ...(details && process.env.NODE_ENV === "development" ? { details } : {}),
    },
    metadata: {
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
      version: "1.0",
    },
  };

  res.status(status).json(response);
}

export function mapErrorToApiResponse(error: unknown): {
  status: number;
  code: ErrorCodeType;
  message: string;
} {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes("not found")) {
      return { status: 404, code: ErrorCode.ENTITY_NOT_FOUND, message: error.message };
    }
    if (msg.includes("already exists") || msg.includes("conflict") || msg.includes("duplicate")) {
      return { status: 409, code: ErrorCode.CONFLICT, message: error.message };
    }
    if (msg.includes("timeout") || msg.includes("timed out")) {
      return { status: 504, code: ErrorCode.DB_TIMEOUT, message: error.message };
    }
    if (msg.includes("circuit") && msg.includes("open")) {
      return { status: 503, code: ErrorCode.CIRCUIT_OPEN, message: error.message };
    }
    if (msg.includes("unauthorized") || msg.includes("authentication")) {
      return { status: 401, code: ErrorCode.UNAUTHORIZED, message: error.message };
    }
  }

  return {
    status: 500,
    code: ErrorCode.INTERNAL_ERROR,
    message: error instanceof Error ? error.message : "An unexpected error occurred",
  };
}
