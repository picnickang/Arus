// Stub file - circuit breakers consolidated.
//
// The legacy ML inference path (`server/ml-prediction/model-loader.ts`)
// historically called `isOpen()`, `recordSuccess()` and `recordFailure()`
// on these stubs. The stub now exposes those methods explicitly so the
// call sites are type-checked rather than relying on `any`.
export interface CB {
  exec: <T>(fn: () => Promise<T>) => Promise<T>;
  state: "closed" | "open" | "half_open";
  failureCount: number;
  lastFailureTime: number | null;
  isOpen(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
}

function make(): CB {
  const cb: CB = {
    exec: <T>(fn: () => Promise<T>) => fn(),
    state: "closed",
    failureCount: 0,
    lastFailureTime: null,
    isOpen(): boolean {
      return cb.state === "open";
    },
    recordSuccess(): void {
      cb.failureCount = 0;
      cb.state = "closed";
    },
    recordFailure(): void {
      cb.failureCount += 1;
      cb.lastFailureTime = Date.now();
    },
  };
  return cb;
}

export const lstmCircuitBreaker: CB = make();
export const randomForestCircuitBreaker: CB = make();
export const xgboostCircuitBreaker: CB = make();
export const ensembleCircuitBreaker: CB = make();
