// Type declarations for the sibling check-route-contract.mjs so the
// tests lane (tsconfig.tests.json) can typecheck tests that import it.
// Keep in sync with the runtime exports.

/** Map of client path → source file (or iterable of [path, file] pairs). */
export function findUnmatched(
  clientPaths: Iterable<[string, string]> | Map<string, string>,
  serverPaths: Iterable<string> | Set<string>
): Array<{ path: string; file: string }>;
