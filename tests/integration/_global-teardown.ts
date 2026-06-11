/**
 * Jest globalTeardown for the integration suite.
 *
 * Closes the shared pg Pool created by tests/integration/forms/_helpers.ts
 * exactly once, after every suite has finished. Doing this in a per-suite
 * afterAll hook causes Jest to hang under the current teardown order, so we
 * defer the single .end() call to here where it is safe.
 *
 * The pool instance is found via a property pinned on `process` by
 * `_helpers.ts`. `process` is the only object truly shared between Jest's
 * sandboxed test-module registry and globalTeardown's loader, so importing
 * `pool` from the helpers module here would otherwise yield a fresh, unused
 * Pool — leaving the real one open and the original drift warning intact.
 */
import type { Pool } from "pg";

const POOL_KEY = "__ARUS_INTEGRATION_PG_POOL__" as const;
type PoolHolder = { [POOL_KEY]?: Pool };

export default async function globalTeardown(): Promise<void> {
  const holder = process as unknown as PoolHolder;
  const pool = holder[POOL_KEY];
  if (!pool) {
    return;
  }
  try {
    await pool.end();
  } catch (err) {
    // Surface but don't fail teardown — a noisy log beats a silent leak.

    console.warn("[integration globalTeardown] pool.end() failed:", err);
  } finally {
    delete holder[POOL_KEY];
  }
}
