/**
 * Dev Fake Data - Development Guards
 * 
 * Safety checks, lock management, and logging utilities.
 */

const DEV_GUARD_ERROR = "DEV ONLY: Set ENABLE_FAKE_TELEMETRY=1 and ensure NODE_ENV !== 'production'";

const seedingLocks = new Map<string, { startTime: number; promise: Promise<any> }>();
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export function isDevModeEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.ENABLE_FAKE_TELEMETRY === '1'
  );
}

export function assertDevMode(): void {
  if (!isDevModeEnabled()) {
    throw new Error(DEV_GUARD_ERROR);
  }
}

function getSeedingLockKey(orgId: string, vesselId: string): string {
  return `${orgId}:${vesselId}`;
}

export function acquireSeedingLock(orgId: string, vesselId: string): boolean {
  const key = getSeedingLockKey(orgId, vesselId);
  const existing = seedingLocks.get(key);
  
  if (existing) {
    const elapsed = Date.now() - existing.startTime;
    if (elapsed < LOCK_TIMEOUT_MS) {
      log('warn', 'Seeding already in progress, blocking concurrent request', { key, elapsedMs: elapsed });
      return false;
    }
    log('warn', 'Stale lock detected, releasing', { key, elapsedMs: elapsed });
    seedingLocks.delete(key);
  }
  
  seedingLocks.set(key, { startTime: Date.now(), promise: Promise.resolve() });
  return true;
}

export function setSeedingLock(orgId: string, vesselId: string, promise: Promise<any>): void {
  const key = getSeedingLockKey(orgId, vesselId);
  seedingLocks.set(key, { startTime: Date.now(), promise });
}

export function releaseSeedingLock(orgId: string, vesselId: string): void {
  const key = getSeedingLockKey(orgId, vesselId);
  seedingLocks.delete(key);
}

type LogLevel = 'info' | 'warn' | 'error';
const logOutputs: Record<LogLevel, (msg: string) => void> = {
  error: (msg) => console.error(msg),
  warn: (msg) => console.warn(msg),
  info: (msg) => console.log(msg),
};

export function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  const prefix = `[DevFakeData]`;
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  logOutputs[level](`${prefix} ${message}${dataStr}`);
}
