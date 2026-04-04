import { db } from "../../db";
import { sql } from "drizzle-orm";
import { logger } from "../../utils/logger";

const MODULE = "efms-poller";

export interface EfmsConnection {
  id: string;
  orgId: string;
  vesselId: string;
  equipmentId: string | null;
  protocol: string;
  host: string;
  port: number;
  slaveId: number;
  registerMap: Record<string, RegisterConfig>;
  pollIntervalMs: number;
}

export interface RegisterConfig {
  register: number;
  type: "float32" | "uint16" | "int16" | "uint32" | "int32";
  unit: string;
  scaling: number;
}

export interface EfmsReading {
  connectionId: string;
  vesselId: string;
  equipmentId: string | null;
  timestamp: Date;
  values: Record<string, { value: number; unit: string }>;
}

function getRows(result: any): any[] {
  return Array.isArray(result) ? result : (result as any)?.rows || [];
}

async function readModbusRegisters(
  host: string,
  port: number,
  slaveId: number,
  startRegister: number,
  count: number,
  timeoutMs: number = 3000
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const net = require("net");
    const socket = new net.Socket();
    let responded = false;

    const timer = setTimeout(() => {
      if (!responded) {
        responded = true;
        socket.destroy();
        reject(new Error(`Modbus timeout: ${host}:${port}`));
      }
    }, timeoutMs);

    socket.connect(port, host, () => {
      const transactionId = Math.floor(Math.random() * 65535);
      const buf = Buffer.alloc(12);
      buf.writeUInt16BE(transactionId, 0);
      buf.writeUInt16BE(0, 2);
      buf.writeUInt16BE(6, 4);
      buf.writeUInt8(slaveId, 6);
      buf.writeUInt8(3, 7);
      buf.writeUInt16BE(startRegister - 40001, 8);
      buf.writeUInt16BE(count, 10);
      socket.write(buf);
    });

    socket.on("data", (data: Buffer) => {
      if (!responded) {
        responded = true;
        clearTimeout(timer);
        socket.destroy();
        if (data.length >= 9 && data[7] === 3) {
          const byteCount = data[8];
          resolve(data.slice(9, 9 + byteCount));
        } else {
          reject(new Error(`Modbus error response: function ${data[7]}`));
        }
      }
    });

    socket.on("error", (err: Error) => {
      if (!responded) {
        responded = true;
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

function parseRegisterValue(
  data: Buffer,
  offset: number,
  type: RegisterConfig["type"],
  scaling: number
): number {
  let raw: number;
  switch (type) {
    case "float32":
      raw = data.readFloatBE(offset);
      break;
    case "uint16":
      raw = data.readUInt16BE(offset);
      break;
    case "int16":
      raw = data.readInt16BE(offset);
      break;
    case "uint32":
      raw = data.readUInt32BE(offset);
      break;
    case "int32":
      raw = data.readInt32BE(offset);
      break;
    default:
      raw = data.readUInt16BE(offset);
  }
  return raw * scaling;
}

class EfmsPollerService {
  private pollers = new Map<string, NodeJS.Timeout>();
  private telemetryCallback: ((reading: EfmsReading) => void) | null = null;

  onReading(callback: (reading: EfmsReading) => void): void {
    this.telemetryCallback = callback;
  }

  async startAll(orgId: string): Promise<number> {
    const result = await db.execute(sql`
      SELECT * FROM efms_connections
      WHERE org_id = ${orgId} AND status != 'disabled'
    `);
    const connections = getRows(result) as any[];

    let started = 0;
    for (const conn of connections) {
      try {
        this.startPoller({
          id: conn.id,
          orgId: conn.org_id,
          vesselId: conn.vessel_id,
          equipmentId: conn.equipment_id,
          protocol: conn.protocol,
          host: conn.host,
          port: conn.port,
          slaveId: conn.slave_id || 1,
          registerMap: conn.register_map || {},
          pollIntervalMs: conn.poll_interval_ms || 5000,
        });
        started++;
      } catch (err) {
        logger.error(MODULE, "Failed to start EFMS poller", { connectionId: conn.id, error: err });
      }
    }

    logger.info(MODULE, "EFMS pollers started", { orgId, count: started, total: connections.length });
    return started;
  }

  startPoller(conn: EfmsConnection): void {
    if (this.pollers.has(conn.id)) {
      clearInterval(this.pollers.get(conn.id)!);
    }

    if (conn.protocol !== "modbus_tcp") {
      logger.warn(MODULE, "Unsupported EFMS protocol", { protocol: conn.protocol, id: conn.id });
      return;
    }

    if (!conn.host || !conn.port) {
      logger.warn(MODULE, "EFMS connection missing host/port", { id: conn.id });
      return;
    }

    const registerEntries = Object.entries(conn.registerMap);
    if (registerEntries.length === 0) {
      logger.warn(MODULE, "EFMS connection has no register map", { id: conn.id });
      return;
    }

    logger.info(MODULE, "Starting EFMS poller", {
      id: conn.id,
      host: conn.host,
      port: conn.port,
      registers: registerEntries.length,
      intervalMs: conn.pollIntervalMs,
    });

    const poll = async () => {
      try {
        const values: Record<string, { value: number; unit: string }> = {};

        for (const [name, config] of registerEntries) {
          const regCount = config.type.includes("32") ? 2 : 1;
          const data = await readModbusRegisters(
            conn.host, conn.port, conn.slaveId,
            config.register, regCount
          );
          const value = parseRegisterValue(data, 0, config.type, config.scaling);
          values[name] = { value, unit: config.unit };
        }

        const reading: EfmsReading = {
          connectionId: conn.id,
          vesselId: conn.vesselId,
          equipmentId: conn.equipmentId,
          timestamp: new Date(),
          values,
        };

        if (this.telemetryCallback) {
          this.telemetryCallback(reading);
        }

        await db.execute(sql`
          UPDATE efms_connections SET
            status = 'polling',
            last_reading_at = NOW(),
            error_message = NULL,
            updated_at = NOW()
          WHERE id = ${conn.id}
        `);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(MODULE, "EFMS poll failed", { id: conn.id, error: msg });

        await db.execute(sql`
          UPDATE efms_connections SET
            status = 'error',
            error_message = ${msg},
            updated_at = NOW()
          WHERE id = ${conn.id}
        `).catch(() => {});
      }
    };

    poll();
    this.pollers.set(conn.id, setInterval(poll, conn.pollIntervalMs));
  }

  stopAll(): void {
    for (const [id, timer] of this.pollers) {
      clearInterval(timer);
      logger.info(MODULE, "EFMS poller stopped", { id });
    }
    this.pollers.clear();
  }

  stop(connectionId: string): void {
    const timer = this.pollers.get(connectionId);
    if (timer) {
      clearInterval(timer);
      this.pollers.delete(connectionId);
    }
  }

  getStatus(): Array<{ id: string; active: boolean }> {
    return [...this.pollers.entries()].map(([id]) => ({ id, active: true }));
  }
}

export const efmsPollerService = new EfmsPollerService();
