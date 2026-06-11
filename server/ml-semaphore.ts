/**
 * Inference semaphore for ML model loading & prediction.
 *
 * Recreated 2026-04 after a refactor left `model-loader.ts` importing
 * `../ml-semaphore.js` from a file that no longer existed, breaking the
 * background job startup.
 *
 * Bounds the number of concurrent in-flight inference operations so a
 * burst of prediction requests cannot exhaust event-loop or GPU memory.
 * Concurrency is configurable via `ML_INFERENCE_CONCURRENCY` (default: 4).
 */

export interface InferenceSemaphore {
  execute<T>(task: () => Promise<T>): Promise<T>;
  inFlight(): number;
  queued(): number;
}

function createSemaphore(maxConcurrent: number): InferenceSemaphore {
  if (!Number.isFinite(maxConcurrent) || maxConcurrent < 1) {
    throw new Error(`ml-semaphore: maxConcurrent must be >= 1, got ${maxConcurrent}`);
  }

  let active = 0;
  const waiters: Array<() => void> = [];

  const acquire = (): Promise<void> =>
    new Promise<void>((resolve) => {
      if (active < maxConcurrent) {
        active += 1;
        resolve();
      } else {
        waiters.push(() => {
          active += 1;
          resolve();
        });
      }
    });

  const release = (): void => {
    active -= 1;
    const next = waiters.shift();
    if (next) {
      next();
    }
  };

  return {
    async execute<T>(task: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await task();
      } finally {
        release();
      }
    },
    inFlight() {
      return active;
    },
    queued() {
      return waiters.length;
    },
  };
}

const parsedLimit = Number.parseInt(process.env["ML_INFERENCE_CONCURRENCY"] ?? "4", 10);
const concurrency = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 4;

export const inferenceSemaphore: InferenceSemaphore = createSemaphore(concurrency);
