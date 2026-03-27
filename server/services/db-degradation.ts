import { logger } from "../utils/logger";

const LOG_CTX = "DbDegradation";

interface CacheEntry {
  data: unknown;
  cachedAt: number;
  key: string;
}

interface QueuedWrite {
  id: string;
  table: string;
  operation: "insert" | "update" | "delete";
  data: unknown;
  queuedAt: Date;
  orgId: string;
}

class DatabaseDegradationService {
  private readCache = new Map<string, CacheEntry>();
  private writeQueue: QueuedWrite[] = [];
  private isDbHealthy = true;
  private maxCacheEntries = 1000;
  private cacheMaxAgeMs = 5 * 60 * 1000;
  private consecutiveFailures = 0;
  private failureThreshold = 3;

  async cachedRead<T>(
    cacheKey: string,
    dbFn: () => Promise<T>,
    options?: { maxAgeMs?: number; fallbackValue?: T }
  ): Promise<{ data: T; fromCache: boolean; staleMs: number | null }> {
    try {
      const result = await dbFn();

      this.readCache.set(cacheKey, {
        data: result,
        cachedAt: Date.now(),
        key: cacheKey,
      });
      this.consecutiveFailures = 0;
      this.isDbHealthy = true;

      if (this.readCache.size > this.maxCacheEntries) {
        const firstKey = this.readCache.keys().next().value;
        if (firstKey) this.readCache.delete(firstKey);
      }

      return { data: result, fromCache: false, staleMs: null };
    } catch (error) {
      this.consecutiveFailures++;

      if (this.consecutiveFailures >= this.failureThreshold) {
        this.isDbHealthy = false;
      }

      const cached = this.readCache.get(cacheKey);
      const maxAge = options?.maxAgeMs ?? this.cacheMaxAgeMs;

      if (cached && (Date.now() - cached.cachedAt) < maxAge) {
        const staleMs = Date.now() - cached.cachedAt;
        logger.warn(LOG_CTX, `Serving stale cache for ${cacheKey} (${staleMs}ms old)`, {
          error: error instanceof Error ? error.message : String(error),
        });
        return { data: cached.data as T, fromCache: true, staleMs };
      }

      if (options?.fallbackValue !== undefined) {
        logger.error(LOG_CTX, `DB and cache miss for ${cacheKey}, using fallback`, {
          error: error instanceof Error ? error.message : String(error),
        });
        return { data: options.fallbackValue, fromCache: true, staleMs: null };
      }

      throw error;
    }
  }

  queueWrite(table: string, operation: QueuedWrite["operation"], data: unknown, orgId: string): string {
    const id = `write-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    this.writeQueue.push({
      id,
      table,
      operation,
      data,
      queuedAt: new Date(),
      orgId,
    });

    logger.info(LOG_CTX, `Write queued: ${operation} on ${table} (queue size: ${this.writeQueue.length})`);

    if (this.writeQueue.length > 500) {
      const dropped = this.writeQueue.shift();
      logger.warn(LOG_CTX, `Write queue overflow — dropped oldest entry: ${dropped?.id}`);
    }

    return id;
  }

  async replayQueuedWrites(
    executeFn: (write: QueuedWrite) => Promise<void>
  ): Promise<{ replayed: number; failed: number; remaining: number }> {
    if (this.writeQueue.length === 0) return { replayed: 0, failed: 0, remaining: 0 };

    let replayed = 0;
    let failed = 0;
    const failedWrites: QueuedWrite[] = [];

    while (this.writeQueue.length > 0) {
      const write = this.writeQueue.shift()!;
      try {
        await executeFn(write);
        replayed++;
      } catch (error) {
        failed++;
        failedWrites.push(write);
        logger.error(LOG_CTX, `Failed to replay write ${write.id}`, error);

        if (failed >= 3) {
          break;
        }
      }
    }

    if (failedWrites.length > 0) {
      this.writeQueue.unshift(...failedWrites);
    }

    logger.info(LOG_CTX, `Queue replay: ${replayed} replayed, ${failed} failed, ${this.writeQueue.length} remaining`);

    return { replayed, failed, remaining: this.writeQueue.length };
  }

  getStatus(): {
    isDbHealthy: boolean;
    cachedEntries: number;
    queuedWrites: number;
    consecutiveFailures: number;
  } {
    return {
      isDbHealthy: this.isDbHealthy,
      cachedEntries: this.readCache.size,
      queuedWrites: this.writeQueue.length,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  markHealthy(): void {
    this.isDbHealthy = true;
    this.consecutiveFailures = 0;
  }
}

export const dbDegradation = new DatabaseDegradationService();
export default DatabaseDegradationService;
