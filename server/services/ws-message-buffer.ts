import { logger } from "../utils/logger";

const LOG_CTX = "WsMessageBuffer";

interface BufferedMessage {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  critical: boolean;
}

interface ClientBuffer {
  clientId: string;
  messages: BufferedMessage[];
  lastSeenId: string | null;
  lastConnectedAt: number;
}

const CRITICAL_EVENT_TYPES = new Set([
  "new_alert",
  "alert_escalated",
  "update_started",
  "update_completed",
  "update_failed",
  "update_rollback",
  "config_updated",
]);

class WsMessageBufferService {
  private buffers = new Map<string, ClientBuffer>();
  private maxMessagesPerClient = 100;
  private bufferTtlMs = 5 * 60 * 1000;

  recordBroadcast(type: string, payload: unknown): string {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const message: BufferedMessage = {
      id,
      type,
      payload,
      timestamp: Date.now(),
      critical: CRITICAL_EVENT_TYPES.has(type),
    };

    for (const buffer of this.buffers.values()) {
      buffer.messages.push(message);

      if (buffer.messages.length > this.maxMessagesPerClient) {
        const critical = buffer.messages.filter(m => m.critical);
        const nonCritical = buffer.messages.filter(m => !m.critical);
        buffer.messages = [...critical, ...nonCritical.slice(-50)];
      }
    }

    return id;
  }

  registerClient(clientId: string): void {
    if (!this.buffers.has(clientId)) {
      this.buffers.set(clientId, {
        clientId,
        messages: [],
        lastSeenId: null,
        lastConnectedAt: Date.now(),
      });
    } else {
      this.buffers.get(clientId)!.lastConnectedAt = Date.now();
    }
  }

  getMissedMessages(clientId: string, lastSeenId?: string): BufferedMessage[] {
    const buffer = this.buffers.get(clientId);
    if (!buffer) return [];

    if (!lastSeenId) {
      return buffer.messages;
    }

    const lastSeenIndex = buffer.messages.findIndex(m => m.id === lastSeenId);

    if (lastSeenIndex === -1) {
      return buffer.messages;
    }

    return buffer.messages.slice(lastSeenIndex + 1);
  }

  acknowledge(clientId: string, messageId: string): void {
    const buffer = this.buffers.get(clientId);
    if (buffer) {
      buffer.lastSeenId = messageId;

      const ackIndex = buffer.messages.findIndex(m => m.id === messageId);
      if (ackIndex > 0) {
        buffer.messages = buffer.messages.filter((m, i) => i >= ackIndex || m.critical);
      }
    }
  }

  handleDisconnect(clientId: string): void {
    const buffer = this.buffers.get(clientId);
    if (buffer) {
      buffer.lastConnectedAt = Date.now();
    }
  }

  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [clientId, buffer] of this.buffers) {
      if (now - buffer.lastConnectedAt > this.bufferTtlMs) {
        this.buffers.delete(clientId);
        cleaned++;
      }
    }

    return cleaned;
  }

  getStats(): { clients: number; totalBuffered: number; criticalBuffered: number } {
    let totalBuffered = 0;
    let criticalBuffered = 0;
    for (const buffer of this.buffers.values()) {
      totalBuffered += buffer.messages.length;
      criticalBuffered += buffer.messages.filter(m => m.critical).length;
    }
    return { clients: this.buffers.size, totalBuffered, criticalBuffered };
  }
}

export const wsMessageBuffer = new WsMessageBufferService();

setInterval(() => wsMessageBuffer.cleanup(), 60 * 1000);

export default WsMessageBufferService;
