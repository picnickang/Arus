export type ShutdownPhase = 'running' | 'draining' | 'shutdown' | 'terminated';

export interface GracefulShutdownConfig {
  drainTimeoutMs: number;
  shutdownTimeoutMs: number;
  signals: NodeJS.Signals[];
}

export interface ShutdownHandler {
  name: string;
  priority: number;
  handler: () => Promise<void>;
}

export interface ShutdownMetrics {
  phase: ShutdownPhase;
  startTime: Date | null;
  drainStartTime: Date | null;
  shutdownStartTime: Date | null;
  handlersExecuted: number;
  handlersTotal: number;
}
