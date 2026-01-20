/**
 * Graceful Degradation Helpers
 */

import { structuredLog } from "../logging";

export const gracefulFallbacks = {
  withCachedFallback: <T>(operation: () => Promise<T>, cachedData: T, operationName: string): Promise<T> => {
    return operation().catch((error) => {
      structuredLog("warn", `${operationName} failed, using cached data`, { operation: "graceful_degradation", metadata: { operationName, fallbackType: "cached" } });
      return cachedData;
    });
  },

  withPartialFallback: <T>(operation: () => Promise<T>, partialData: T, operationName: string): Promise<T> => {
    return operation().catch((error) => {
      structuredLog("warn", `${operationName} failed, using partial data`, { operation: "graceful_degradation", metadata: { operationName, fallbackType: "partial" } });
      return partialData;
    });
  },

  withDefaultFallback: <T>(operation: () => Promise<T>, defaultValue: T, operationName: string): Promise<T> => {
    return operation().catch((error) => {
      structuredLog("warn", `${operationName} failed, using default value`, { operation: "graceful_degradation", metadata: { operationName, fallbackType: "default" } });
      return defaultValue;
    });
  },
};
