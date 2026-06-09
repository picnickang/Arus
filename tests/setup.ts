/**
 * Jest Test Setup
 *
 * Configures test environment for server-side integration tests.
 */

import { jest } from "@jest/globals";
import { createHook, type AsyncHook } from "node:async_hooks";

jest.setTimeout(30000);

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET ||= "integration-test-session-secret-not-for-production";
process.env.ARUS_DEV_LOGIN = "0";

const explicitIntegrationDb =
  process.env.ARUS_INTEGRATION_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
const isIntegrationJestRun = process.argv.some((arg) => arg.includes("jest.integration.config"));

if (explicitIntegrationDb) {
  process.env.DATABASE_URL = explicitIntegrationDb;
  process.env.ARUS_DEPLOYMENT_MODE = "CLOUD";
  process.env.LOCAL_MODE = "false";
  process.env.EMBEDDED_MODE = "false";
} else {
  delete process.env.DATABASE_URL;
  process.env.ARUS_DEPLOYMENT_MODE = "VESSEL";
  process.env.DEPLOYMENT_MODE = "VESSEL";
  process.env.LOCAL_MODE = "true";
  process.env.EMBEDDED_MODE = "true";
}

process.env.DISABLE_REDIS = "true";
process.env.DISABLE_RATE_LIMITS = "true";
process.env.DISABLE_JOB_QUEUE = "true";
process.env.DISABLE_EMAIL_WORKER = "true";
process.env.DISABLE_TELEMETRY_BATCH_WRITER = "true";
process.env.DISABLE_OBSERVABILITY_TIMERS = "true";
process.env.DISABLE_SECURITY_TIMERS = "true";
process.env.DISABLE_AGENT_SCHEDULER = "true";
process.env.DISABLE_DIGITAL_TWIN_STARTUP = "true";
process.env.DISABLE_ML_SERVICE_STARTUP = "true";
process.env.DISABLE_MODEL_BACKED_INFERENCE = "true";
process.env.ENABLE_AUTO_REPLAN = "false";
process.env.ENABLE_BACKGROUND_JOBS = "false";
process.env.ENABLE_SCHEDULERS = "false";
process.env.ENABLE_SYNC_SERVICES = "false";
process.env.ENABLE_UPDATE_SYSTEM = "false";
process.env.EVENT_SPINE_ANALYTICS = "0";
process.env.EVENT_SPINE_DISABLED = "1";
process.env.EVENT_SPINE_WORKER = "0";

const trackedAsyncResources = new Map<
  number,
  {
    stack: string | undefined;
    triggerAsyncId: number;
    type: string;
  }
>();
let asyncDebugHook: AsyncHook | undefined;

if (process.env.ARUS_DEBUG_OPEN_HANDLES === "true") {
  asyncDebugHook = createHook({
    destroy(asyncId) {
      trackedAsyncResources.delete(asyncId);
    },
    init(asyncId, type, triggerAsyncId) {
      if (
        type.includes("Timeout") ||
        type.includes("Timer") ||
        type.includes("Immediate") ||
        type.includes("Idle") ||
        type.includes("TCP") ||
        type.includes("PIPE") ||
        type.includes("FSREQ")
      ) {
        trackedAsyncResources.set(asyncId, {
          stack: new Error().stack,
          triggerAsyncId,
          type,
        });
      }
    },
    promiseResolve(asyncId) {
      trackedAsyncResources.delete(asyncId);
    },
  });
  asyncDebugHook.enable();
}

beforeAll(async () => {
  console.log("[Test Setup] Starting test environment...");
});

function withCleanupTimeout<T>(
  label: string,
  promise: Promise<T>,
  timeoutMs: number
): Promise<T | undefined> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<undefined>((resolve) => {
    timeout = setTimeout(() => {
      console.warn(`[Test Setup] Cleanup task timed out after ${timeoutMs}ms: ${label}`);
      resolve(undefined);
    }, timeoutMs);
    timeout.unref?.();
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

async function cleanupResidualNetworkHandles(): Promise<void> {
  const getActiveHandles = (process as unknown as { _getActiveHandles?: () => unknown[] })
    ._getActiveHandles;
  const handles = getActiveHandles?.() ?? [];

  const closeTasks: Array<Promise<void>> = [];

  for (const handle of handles) {
    const ctor = (handle as { constructor?: { name?: string } }).constructor?.name;
    if (ctor === "Server") {
      const server = handle as {
        listening?: boolean;
        close?: (callback?: (error?: Error) => void) => void;
        closeAllConnections?: () => void;
        unref?: () => void;
      };
      try {
        server.closeAllConnections?.();
        server.unref?.();
        if (server.close && server.listening) {
          closeTasks.push(
            withCleanupTimeout(
              "server.close",
              new Promise((resolve) => {
                try {
                  server.close?.(() => resolve());
                } catch {
                  resolve();
                }
              }),
              1000
            )
          );
        }
      } catch {
        // A closed Supertest server can still appear briefly in active handles.
      }
    } else if (ctor === "Socket") {
      const socket = handle as {
        localAddress?: string;
        remoteAddress?: string;
        destroyed?: boolean;
        destroy?: () => void;
        unref?: () => void;
      };
      const isNetworkSocket = Boolean(socket.localAddress || socket.remoteAddress);
      if (isNetworkSocket) {
        socket.unref?.();
        if (!socket.destroyed) {
          socket.destroy?.();
        }
      }
    }
  }

  await Promise.all(closeTasks);
  await new Promise((resolve) => setImmediate(resolve));
}

afterAll(async () => {
  console.log("[Test Setup] Cleaning up test environment...");
  const cleanupTasks: Array<Promise<void | undefined>> = [];

  cleanupTasks.push(
    withCleanupTimeout(
      "telemetryBatchWriter.stop",
      import("../server/telemetry-batch-writer")
        .then(({ telemetryBatchWriter }) => telemetryBatchWriter.stop())
        .catch(() => undefined),
      2500
    )
  );
  cleanupTasks.push(
    withCleanupTimeout(
      "mqttReliableSync.stop",
      import("../server/mqtt-reliable-sync")
        .then(({ mqttReliableSync }) => mqttReliableSync.stop())
        .catch(() => undefined),
      2500
    )
  );
  cleanupTasks.push(
    withCleanupTimeout(
      "redisClientFactory.disconnect",
      import("../server/lib/redis-client")
        .then(({ redisClientFactory }) => redisClientFactory.disconnect())
        .catch(() => undefined),
      2500
    )
  );
  if (!isIntegrationJestRun) {
    cleanupTasks.push(
      withCleanupTimeout(
        "db-config close",
        import("../server/db-config")
          .then(async ({ libsqlClient, pool }) => {
            const clientClose = (libsqlClient as { close?: () => void | Promise<void> } | null)
              ?.close;
            if (clientClose) {
              await clientClose.call(libsqlClient);
            }
            await pool?.end?.();
          })
          .catch(() => undefined),
        2500
      )
    );
  }

  await withCleanupTimeout("all cleanup tasks", Promise.all(cleanupTasks), 5000);
  await withCleanupTimeout("cleanupResidualNetworkHandles", cleanupResidualNetworkHandles(), 2000);

  if (process.env.ARUS_DEBUG_OPEN_HANDLES === "true") {
    const getActiveHandles = (process as unknown as { _getActiveHandles?: () => unknown[] })
      ._getActiveHandles;
    const getActiveRequests = (process as unknown as { _getActiveRequests?: () => unknown[] })
      ._getActiveRequests;
    const handles = getActiveHandles?.() ?? [];
    console.log(
      "[Test Setup] Active handles after cleanup:",
      handles.map((handle) => {
        const ctor = (handle as { constructor?: { name?: string } }).constructor?.name;
        if (ctor === "Server") {
          const server = handle as {
            listening?: boolean;
            address?: () => unknown;
          };
          return {
            type: ctor,
            listening: server.listening,
            address: server.address?.(),
          };
        }
        if (ctor === "Socket") {
          const socket = handle as {
            localAddress?: string;
            localPort?: number;
            remoteAddress?: string;
            remotePort?: number;
            destroyed?: boolean;
            readyState?: string;
          };
          return {
            type: ctor,
            localAddress: socket.localAddress,
            localPort: socket.localPort,
            remoteAddress: socket.remoteAddress,
            remotePort: socket.remotePort,
            destroyed: socket.destroyed,
            readyState: socket.readyState,
          };
        }
        return { type: ctor ?? typeof handle };
      })
    );
    console.log(
      "[Test Setup] Active requests after cleanup:",
      (getActiveRequests?.() ?? []).map((request) => ({
        type: (request as { constructor?: { name?: string } }).constructor?.name ?? typeof request,
      }))
    );
    const getReport = (
      process as unknown as {
        report?: { getReport?: () => { libuv?: Array<Record<string, unknown>> } };
      }
    ).report?.getReport;
    const libuvHandles = getReport?.().libuv ?? [];
    console.log(
      "[Test Setup] Referenced libuv handles after cleanup:",
      libuvHandles.filter((handle) => handle["is_referenced"] === true)
    );
    console.log(
      "[Test Setup] Tracked async resources after cleanup:",
      Array.from(trackedAsyncResources.entries()).map(([asyncId, resource]) => ({
        asyncId,
        triggerAsyncId: resource.triggerAsyncId,
        type: resource.type,
        stack: resource.stack?.split("\n").slice(0, 8).join("\n"),
      }))
    );
  }
  asyncDebugHook?.disable();
});

beforeEach(() => {});

afterEach(() => {
  jest.clearAllMocks();
});
