import type { BroadcastPayload } from "./websocket-types";

export class TelemetryThrottler {
  private pendingUpdates: Map<string, BroadcastPayload> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private broadcastFn: ((channel: string, data: BroadcastPayload) => void) | null = null;

  constructor(private readonly intervalMs: number = 250) {}

  start(broadcastFn: (channel: string, data: BroadcastPayload) => void): void {
    this.broadcastFn = broadcastFn;
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(() => {
      this.flush();
    }, this.intervalMs);
    this.intervalId.unref?.();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  queue(equipmentId: string, data: BroadcastPayload): void {
    this.pendingUpdates.set(equipmentId, data);
  }

  private flush(): void {
    if (this.pendingUpdates.size === 0 || !this.broadcastFn) {
      return;
    }

    const batch = Array.from(this.pendingUpdates.values());
    this.pendingUpdates.clear();

    this.broadcastFn("telemetry", {
      type: "telemetry_batch",
      data: batch,
      count: batch.length,
      timestamp: new Date().toISOString(),
    });
  }
}
