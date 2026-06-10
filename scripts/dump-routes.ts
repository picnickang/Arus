/**
 * Dump the server's actual Express route table as JSON (one path per line
 * is avoided; single JSON array on stdout, logs go to stderr).
 *
 * Boots the real `registerRoutes(app)` against a throwaway express app —
 * the same registration production uses — then walks `app._router.stack`,
 * reconstructing mount prefixes from layer regexps. Used by
 * scripts/check-route-contract.mjs so the contract check reflects what the
 * server truly serves, not what static greps can find.
 *
 * Heavy subsystems are disabled via the same env switches the test suite
 * uses; a DATABASE_URL must be set (any reachable or even unreachable PG
 * URL — route registration does not connect eagerly).
 */

import express from "express";

process.env["ENABLE_BACKGROUND_JOBS"] = "false";
process.env["ENABLE_SCHEDULERS"] = "false";
process.env["DISABLE_RATE_LIMITS"] = "true";
process.env["NODE_ENV"] ||= "test";
process.env["SESSION_SECRET"] ||= "route-dump-not-a-secret";
process.env["DATABASE_URL"] ||= "postgresql://postgres:postgres@localhost:5432/postgres";

// Silence stdout chatter from registration-time logging; keep stderr.
// (console.log reassignment is the point here — the JSON contract on
// stdout must stay clean.)
// eslint-disable-next-line no-console
const realLog = console.log;
// eslint-disable-next-line no-console
console.log = (...args: unknown[]) => console.error(...args);

interface Layer {
  route?: { path: string | string[] };
  name: string;
  handle?: { stack?: Layer[] };
  regexp?: RegExp & { fast_slash?: boolean };
}

function mountPathFromRegexp(regexp: RegExp & { fast_slash?: boolean }): string {
  if (regexp.fast_slash) {
    return "";
  }
  // Express encodes mounts like /^\/api\/pdm\/health\/?(?=\/|$)/i — decode
  // the literal prefix and restore param segments (encoded as capture
  // groups `(?:([^\/]+?))`) as `:param`.
  return regexp.source
    .replace(/^\^/, "")
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, "")
    .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ":param")
    .replace(/\\\//g, "/");
}

function walk(stack: Layer[], prefix: string, out: Set<string>): void {
  for (const layer of stack) {
    if (layer.route) {
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      for (const p of paths) {
        out.add(prefix + p);
      }
    } else if (layer.name === "router" && layer.handle?.stack && layer.regexp) {
      walk(layer.handle.stack, prefix + mountPathFromRegexp(layer.regexp), out);
    }
  }
}

async function main() {
  const { registerRoutes } = await import("../server/routes.js");
  const app = express();
  const server = await registerRoutes(app);

  const stack = (app as unknown as { _router?: { stack: Layer[] } })._router?.stack ?? [];
  const routes = new Set<string>();
  walk(stack, "", routes);

  realLog(JSON.stringify([...routes].sort(), null, 0));

  // registerRoutes may return an http.Server and spin up sockets/timers.
  await new Promise<void>((resolveClose) => {
    try {
      (server as { close?: (cb: () => void) => void })?.close?.(() => resolveClose());
      setTimeout(resolveClose, 1000);
    } catch {
      resolveClose();
    }
  });
  process.exit(0);
}

main().catch((err) => {
  console.error("[dump-routes] failed:", err);
  process.exit(1);
});
