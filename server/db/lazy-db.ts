/**
 * Lazy db-config resolver.
 *
 * Some modules (e.g. tenancy/quota-service) want to keep `db-config` off the
 * module graph until first use — so unit tests that exercise the class with an
 * injected executor never pull a live Postgres connection. This helper lives
 * under server/db so those modules can depend on the storage layer (an allowed
 * hexagonal importer of db-config) rather than importing db-config themselves.
 */
export async function getDbExecutor(): Promise<{ execute(query: unknown): Promise<unknown> }> {
  const mod = await import("../db-config");
  return mod.db as { execute(query: unknown): Promise<unknown> };
}
