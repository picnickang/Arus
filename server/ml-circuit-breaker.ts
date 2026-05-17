// Stub file - circuit breakers consolidated
interface CB {
  exec: <T>(fn: () => Promise<T>) => Promise<T>;
  state: string;
  failureCount: number;
  lastFailureTime: number | null;
}
const make = (): CB => ({
  exec: <T>(fn: () => Promise<T>) => fn(),
  state: "closed",
  failureCount: 0,
  lastFailureTime: null,
});
export const lstmCircuitBreaker: CB = make();
export const randomForestCircuitBreaker: CB = make();
export const xgboostCircuitBreaker: CB = make();
export const ensembleCircuitBreaker: CB = make();
