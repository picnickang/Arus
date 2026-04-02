import { EventEmitter } from "node:events";
import type { DomainEventMap, DomainEventName } from "./types.js";

export type DomainEventHandler<K extends DomainEventName> = (
  event: DomainEventMap[K],
) => void | Promise<void>;

export type EventMiddleware = (
  eventType: DomainEventName,
  event: DomainEventMap[DomainEventName],
) => void;

class DomainEventBusImpl {
  private emitter = new EventEmitter();
  private middlewares: EventMiddleware[] = [];

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  emit<K extends DomainEventName>(
    eventType: K,
    event: DomainEventMap[K],
  ): void {
    for (const mw of this.middlewares) {
      try {
        mw(eventType, event);
      } catch {
        // middleware errors must not block event flow
      }
    }
    this.emitter.emit(eventType, event);
  }

  on<K extends DomainEventName>(
    eventType: K,
    handler: DomainEventHandler<K>,
  ): void {
    this.emitter.on(eventType, handler as (...args: unknown[]) => void);
  }

  once<K extends DomainEventName>(
    eventType: K,
    handler: DomainEventHandler<K>,
  ): void {
    this.emitter.once(eventType, handler as (...args: unknown[]) => void);
  }

  off<K extends DomainEventName>(
    eventType: K,
    handler: DomainEventHandler<K>,
  ): void {
    this.emitter.off(eventType, handler as (...args: unknown[]) => void);
  }

  use(middleware: EventMiddleware): void {
    this.middlewares.push(middleware);
  }

  emitUnchecked(eventType: DomainEventName, event: DomainEventMap[DomainEventName]): void {
    for (const mw of this.middlewares) {
      try {
        mw(eventType, event);
      } catch {
      }
    }
    this.emitter.emit(eventType, event);
  }

  listenerCount(eventType: DomainEventName): number {
    return this.emitter.listenerCount(eventType);
  }

  removeAllListeners(eventType?: DomainEventName): void {
    if (eventType) {
      this.emitter.removeAllListeners(eventType);
    } else {
      this.emitter.removeAllListeners();
    }
  }
}

export const domainEventBus = new DomainEventBusImpl();
