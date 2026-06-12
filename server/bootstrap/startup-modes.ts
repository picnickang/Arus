import type { createLogger } from "../lib/structured-logger";
import { createRequire } from "node:module";
import bcrypt from "bcryptjs";

type StartupLogger = ReturnType<typeof createLogger>;
const requireFromHere = createRequire(
  typeof import.meta.url === "string" ? import.meta.url : __filename
);

export interface StartupModes {
  isInitDbMode: boolean;
  isHealthCheckMode: boolean;
}

export function getStartupModes(argv = process.argv): StartupModes {
  return {
    isInitDbMode: argv.includes("--init-db"),
    isHealthCheckMode: argv.includes("--health-check"),
  };
}

export function shouldRunHttpServer(modes: StartupModes): boolean {
  return !modes.isInitDbMode && !modes.isHealthCheckMode;
}

export function runInitDbMode(modes: StartupModes, logger: StartupLogger): void {
  if (!modes.isInitDbMode) {
    return;
  }

  import("../init-db-entry.js")
    .then((m: { initDb: () => unknown }) => m.initDb())
    .then(() => {
      logger.info("[ARUS] --init-db complete");
      process.exit(0);
    })
    .catch((err: unknown) => {
      logger.error("[ARUS] --init-db failed:", undefined, err);
      process.exit(1);
    });
}

export function runHealthCheckMode(modes: StartupModes, logger: StartupLogger): void {
  if (!modes.isHealthCheckMode) {
    return;
  }

  logger.info("[ARUS] Health check: testing native module loading...");
  (async () => {
    try {
      const { createClient } = requireFromHere("@libsql/client") as typeof import("@libsql/client");
      const client = createClient({ url: ":memory:" });
      await client.execute("SELECT 1 AS ok");
      client.close();
      logger.info("[ARUS] Health check: @libsql/client OK");

      const bcryptApi = bcrypt as object as {
        hash: (s: string, n: number) => Promise<string>;
        compare: (a: string, b: string) => Promise<boolean>;
      };
      const hash = await bcryptApi.hash("test", 8);
      const ok = await bcryptApi.compare("test", hash);
      if (!ok) {
        throw new Error("bcryptjs hash/compare mismatch");
      }
      logger.info("[ARUS] Health check: bcryptjs OK");

      logger.info("[ARUS] Health check: PASSED");
      process.exit(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("[ARUS] Health check: FAILED —", undefined, msg);
      process.exit(1);
    }
  })();
}
