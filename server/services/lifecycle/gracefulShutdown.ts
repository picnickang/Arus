import { EventEmitter } from 'node:events';
import { logger } from '../../utils/logger';
import type { ShutdownPhase, GracefulShutdownConfig, ShutdownHandler, ShutdownMetrics } from './types';

const DEFAULT_CONFIG: GracefulShutdownConfig = {
  drainTimeoutMs: 10000,
  shutdownTimeoutMs: 30000,
  signals: ['SIGTERM', 'SIGINT'],
};

export class GracefulShutdownManager extends EventEmitter {
  private phase: ShutdownPhase = 'running';
  private handlers: ShutdownHandler[] = [];
  private startTime: Date | null = null;
  private drainStartTime: Date | null = null;
  private shutdownStartTime: Date | null = null;
  private handlersExecuted = 0;
  private readonly config: GracefulShutdownConfig;
  private signalHandlers: Map<NodeJS.Signals, () => void> = new Map();

  constructor(config: Partial<GracefulShutdownConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  registerHandler(name: string, handler: () => Promise<void>, priority = 100): void {
    this.handlers.push({ name, handler, priority });
    this.handlers.sort((a, b) => a.priority - b.priority);
    logger.info('GracefulShutdown', `Registered handler: ${name} (priority: ${priority})`);
  }

  unregisterHandler(name: string): void {
    this.handlers = this.handlers.filter(h => h.name !== name);
  }

  getPhase(): ShutdownPhase {
    return this.phase;
  }

  isDraining(): boolean {
    return this.phase === 'draining';
  }

  isShuttingDown(): boolean {
    return this.phase !== 'running';
  }

  getMetrics(): ShutdownMetrics {
    return {
      phase: this.phase,
      startTime: this.startTime,
      drainStartTime: this.drainStartTime,
      shutdownStartTime: this.shutdownStartTime,
      handlersExecuted: this.handlersExecuted,
      handlersTotal: this.handlers.length,
    };
  }

  attachSignalHandlers(): void {
    for (const signal of this.config.signals) {
      const handler = () => {
        logger.info('GracefulShutdown', `Received ${signal}, initiating shutdown...`);
        this.initiateShutdown().catch(err => {
          logger.error('GracefulShutdown', 'Shutdown error', err);
          process.exit(1);
        });
      };
      this.signalHandlers.set(signal, handler);
      process.on(signal, handler);
    }
  }

  detachSignalHandlers(): void {
    for (const [signal, handler] of this.signalHandlers) {
      process.removeListener(signal, handler);
    }
    this.signalHandlers.clear();
  }

  async initiateShutdown(): Promise<void> {
    if (this.phase !== 'running') {
      logger.warn('GracefulShutdown', `Already in ${this.phase} phase`);
      return;
    }

    this.startTime = new Date();
    await this.startDrainPhase();
    await this.startShutdownPhase();
    this.phase = 'terminated';
    this.emit('terminated');

    logger.info('GracefulShutdown', 'Shutdown complete');
  }

  private async startDrainPhase(): Promise<void> {
    this.phase = 'draining';
    this.drainStartTime = new Date();
    this.emit('draining');
    logger.info('GracefulShutdown', `Drain phase started (timeout: ${this.config.drainTimeoutMs}ms)`);

    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        logger.warn('GracefulShutdown', 'Drain timeout reached');
        resolve();
      }, this.config.drainTimeoutMs);

      this.once('drainComplete', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  completeDrain(): void {
    if (this.phase === 'draining') {
      this.emit('drainComplete');
    }
  }

  private async startShutdownPhase(): Promise<void> {
    this.phase = 'shutdown';
    this.shutdownStartTime = new Date();
    this.emit('shutdown');
    logger.info('GracefulShutdown', `Shutdown phase started (${this.handlers.length} handlers)`);

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Shutdown timeout')), this.config.shutdownTimeoutMs);
    });

    const handlerPromise = this.executeHandlers();

    try {
      await Promise.race([handlerPromise, timeoutPromise]);
    } catch (err) {
      logger.error('GracefulShutdown', 'Shutdown handlers did not complete in time');
    }
  }

  private async executeHandlers(): Promise<void> {
    for (const { name, handler } of this.handlers) {
      try {
        logger.info('GracefulShutdown', `Executing handler: ${name}`);
        await handler();
        this.handlersExecuted++;
        logger.info('GracefulShutdown', `Handler completed: ${name}`);
      } catch (err) {
        logger.error('GracefulShutdown', `Handler failed: ${name}`, err);
      }
    }
  }
}

let globalShutdownManager: GracefulShutdownManager | null = null;

export function getShutdownManager(config?: Partial<GracefulShutdownConfig>): GracefulShutdownManager {
  if (!globalShutdownManager) {
    globalShutdownManager = new GracefulShutdownManager(config);
  }
  return globalShutdownManager;
}

export function resetShutdownManager(): void {
  if (globalShutdownManager) {
    globalShutdownManager.detachSignalHandlers();
    globalShutdownManager.removeAllListeners();
    globalShutdownManager = null;
  }
}
