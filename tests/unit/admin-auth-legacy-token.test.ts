/**
 * Legacy plaintext admin-token gate (security follow-up — Finding 5).
 *
 * `ADMIN_TOKEN` is a plaintext credential in the process environment — trivial
 * to exfiltrate from crash dumps, /proc, or a child process env. It was kept as
 * a dev convenience, but must NEVER be the basis of admin auth in production.
 * This pins the behaviour of `getAdminCredential()`:
 *   - production (`NODE_ENV=production`) ignores `ADMIN_TOKEN` entirely; with no
 *     hash provisioned the credential is empty (admin auth disabled);
 *   - a bcrypt `ADMIN_TOKEN_HASH` is always honoured, in prod and non-prod, and
 *     takes precedence over the plaintext token;
 *   - non-production still honours the plaintext fallback for local dev.
 *
 * No database hash is configured in the unit environment, so
 * `readDatabaseAdminHash()` resolves to undefined and the env-var branches are
 * exercised directly — exactly the surface this fix changed.
 */
process.env["NODE_ENV"] = "test";

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";

let getAdminCredential: () => Promise<{ hash?: string; legacyPlaintext?: string }>;

const ENV_KEYS = ["NODE_ENV", "ADMIN_TOKEN", "ADMIN_TOKEN_HASH"] as const;
let savedEnv: Record<string, string | undefined>;

beforeAll(async () => {
  const mod = await import("../../server/domains/system-admin/routes/auth-routes");
  getAdminCredential = mod.getAdminCredential;
});

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  delete process.env["ADMIN_TOKEN"];
  delete process.env["ADMIN_TOKEN_HASH"];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = savedEnv[k];
    }
  }
});

describe("getAdminCredential — legacy plaintext token gate (Finding 5)", () => {
  it("ignores plaintext ADMIN_TOKEN in production (admin auth disabled)", async () => {
    process.env["NODE_ENV"] = "production";
    process.env["ADMIN_TOKEN"] = "super-secret-plaintext";

    const credential = await getAdminCredential();

    expect(credential.legacyPlaintext).toBeUndefined();
    expect(credential.hash).toBeUndefined();
  });

  it("honours ADMIN_TOKEN_HASH in production (hash-only path)", async () => {
    process.env["NODE_ENV"] = "production";
    process.env["ADMIN_TOKEN_HASH"] = "$2a$10$bcrypthashvalue";
    process.env["ADMIN_TOKEN"] = "ignored-in-prod";

    const credential = await getAdminCredential();

    expect(credential.hash).toBe("$2a$10$bcrypthashvalue");
    expect(credential.legacyPlaintext).toBeUndefined();
  });

  it("prefers ADMIN_TOKEN_HASH over the plaintext token in non-production too", async () => {
    process.env["NODE_ENV"] = "development";
    process.env["ADMIN_TOKEN_HASH"] = "$2a$10$devhash";
    process.env["ADMIN_TOKEN"] = "dev-plaintext";

    const credential = await getAdminCredential();

    expect(credential.hash).toBe("$2a$10$devhash");
    expect(credential.legacyPlaintext).toBeUndefined();
  });

  it("honours the legacy plaintext fallback in non-production (dev convenience)", async () => {
    process.env["NODE_ENV"] = "development";
    process.env["ADMIN_TOKEN"] = "dev-plaintext-token";

    const credential = await getAdminCredential();

    expect(credential.legacyPlaintext).toBe("dev-plaintext-token");
    expect(credential.hash).toBeUndefined();
  });

  it("returns an empty credential when nothing is configured", async () => {
    process.env["NODE_ENV"] = "production";

    const credential = await getAdminCredential();

    expect(credential.hash).toBeUndefined();
    expect(credential.legacyPlaintext).toBeUndefined();
  });
});
