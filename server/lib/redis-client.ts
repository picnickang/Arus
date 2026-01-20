/**
 * Shared Redis Client Factory
 * Single connection shared across all consumers with circuit breaker
 * Eliminates multiple ECONNREFUSED errors during boot
 */

import Redis from "ioredis";
import { logger } from "../utils/logger.js";

interface RedisClientOptions {
  connectTimeout?: number;
  circuitBreakerCooldownMs?: number;
}

type RedisStatus = "connecting" | "connected" | "disconnected" | "circuit_open";

class RedisClientFactory {
  private static instance: RedisClientFactory;
  private client: Redis | null = null;
  private status: RedisStatus = "disconnected";
  private lastFailure: number = 0;
  private circuitBreakerCooldownMs: number;
  private connectTimeout: number;
  private initPromise: Promise<Redis | null> | null = null;
  private enabled: boolean;
  private failureLogged: boolean = false;

  private constructor(options: RedisClientOptions = {}) {
    this.connectTimeout = options.connectTimeout ?? 250;
    this.circuitBreakerCooldownMs = options.circuitBreakerCooldownMs ?? 60000;
    this.enabled = process.env.REDIS_ENABLED !== "false";
  }

  static getInstance(options?: RedisClientOptions): RedisClientFactory {
    if (!RedisClientFactory.instance) {
      RedisClientFactory.instance = new RedisClientFactory(options);
    }
    return RedisClientFactory.instance;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isCircuitOpen(): boolean {
    if (this.status !== "circuit_open") return false;
    const now = Date.now();
    if (now - this.lastFailure >= this.circuitBreakerCooldownMs) {
      this.status = "disconnected";
      this.failureLogged = false;
      return false;
    }
    return true;
  }

  async getClient(): Promise<Redis | null> {
    if (!this.enabled) {
      return null;
    }

    if (this.isCircuitOpen()) {
      return null;
    }

    if (this.client && this.status === "connected") {
      return this.client;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.connect();
    const result = await this.initPromise;
    this.initPromise = null;
    return result;
  }

  private async connect(): Promise<Redis | null> {
    const host = process.env.REDIS_HOST || "localhost";
    const port = parseInt(process.env.REDIS_PORT || "6379", 10);
    const password = process.env.REDIS_PASSWORD;

    this.status = "connecting";

    try {
      this.client = new Redis({
        host,
        port,
        password,
        connectTimeout: this.connectTimeout,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        enableOfflineQueue: false,
        lazyConnect: true,
      });

      // Attach error handler BEFORE connecting to prevent unhandled error events
      this.client.on("error", (err) => {
        this.handleError(err);
      });

      const connectPromise = this.client.connect();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout")), this.connectTimeout)
      );

      await Promise.race([connectPromise, timeoutPromise]);

      this.status = "connected";
      logger.info("RedisClient", `Connected to Redis at ${host}:${port}`);

      this.client.on("close", () => {
        if (this.status === "connected") {
          this.status = "disconnected";
        }
      });

      return this.client;
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  private handleError(error: unknown): void {
    this.status = "circuit_open";
    this.lastFailure = Date.now();

    if (!this.failureLogged) {
      const cooldownSec = Math.round(this.circuitBreakerCooldownMs / 1000);
      logger.warn(
        "RedisClient",
        `Redis unavailable, circuit breaker open for ${cooldownSec}s. Falling back to in-memory.`
      );
      this.failureLogged = true;
    }

    if (this.client) {
      try {
        this.client.disconnect();
      } catch {
      }
      this.client = null;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const client = await this.getClient();
      if (!client) return false;
      const result = await client.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }

  getStatus(): RedisStatus {
    if (this.isCircuitOpen()) return "circuit_open";
    return this.status;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.client = null;
      this.status = "disconnected";
    }
  }
}

export const redisClientFactory = RedisClientFactory.getInstance({
  connectTimeout: 250,
  circuitBreakerCooldownMs: 60000,
});

export async function getSharedRedisClient(): Promise<Redis | null> {
  return redisClientFactory.getClient();
}

export function isRedisEnabled(): boolean {
  return redisClientFactory.isEnabled();
}

export function getRedisStatus(): RedisStatus {
  return redisClientFactory.getStatus();
}
