/**
 * Legacy sync manager shim.
 *
 * The original sync-manager module was removed during the hexagonal refactor.
 * Consumers are kept for backwards compatibility but throw at runtime so the
 * deprecation is loud rather than silent.
 */

function notImplemented(name: string): never {
  throw new Error(`[sync-manager] '${name}' is no longer available. Use the domains/sync service.`);
}

export const syncManager = {
  async start(): Promise<void> {
    notImplemented("start");
  },
  async stop(): Promise<void> {
    notImplemented("stop");
  },
  async getStatus(): Promise<unknown> {
    notImplemented("getStatus");
  },
};
