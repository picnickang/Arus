/**
   * CANONICAL HOME — Devices
   * ============================================================
   * This module is the single canonical home for Devices data
   * access. Other layers (domain adapters under
   * `server/domains/devices/infrastructure/`, legacy route handlers,
   * cross-domain readers in `server/composition/*`, etc.) MUST import
   * the `db…Storage` singleton from this file directly rather than
   * routing through `server/repositories.ts`. Push B4 (Repositories
   * Proxy Decomposition) removed the four primary-domain importers of
   * that proxy; the proxy now exists only as a transitional re-export
   * barrel for legacy non-domain consumers. New code MUST import from
   * here.
   * ============================================================
   */
  /**
 * Devices Repository
 * Handles devices, heartbeats, and PDM scores
 */
import { db } from "../../db-config.js";
import {
  devices,
  edgeHeartbeats as edgeHeartbeatsTable,
  pdmScoreLogs as pdmScoreLogsTable,
} from "@shared/schema-runtime";
import { eq, sql } from "drizzle-orm";
import type { WidenPartial } from "../../lib/widen-partial";
import type {
  Device,
  InsertDevice,
  EdgeHeartbeat,
  InsertEquipmentHeartbeat as InsertHeartbeat,
  PdmScoreLog,
  InsertPdmScoreLog as InsertPdmScore,
} from "@shared/schema";

export class DatabaseDevicesStorage {
  private getEffectiveOrgId(orgId?: string): string {
    return orgId?.trim() || "default-org";
  }
  async getDevices(orgId?: string): Promise<Device[]> {
    return db.select().from(devices);
  }
  async getDevice(id: string, orgId?: string): Promise<Device | undefined> {
    const r = await db.select().from(devices).where(eq(devices.id, id));
    return r[0];
  }
  async createDevice(data: InsertDevice): Promise<Device> {
    const r = await db.insert(devices).values(data).returning();
    if (!r[0]) throw new Error("Failed to create device");
    return r[0];
  }
  async updateDevice(
    id: string,
    data: WidenPartial<InsertDevice>,
    orgId?: string
  ): Promise<Device | undefined> {
    const r = await db.update(devices).set(data).where(eq(devices.id, id)).returning();
    return r[0];
  }
  async deleteDevice(id: string, orgId?: string): Promise<boolean> {
    const r = await db.delete(devices).where(eq(devices.id, id)).returning();
    return r.length > 0;
  }
  async getHeartbeatsByOrg(orgId?: string): Promise<EdgeHeartbeat[]> {
    return db.select().from(edgeHeartbeatsTable);
  }
  async getHeartbeats(deviceId: string, orgId?: string): Promise<EdgeHeartbeat[]> {
    return db
      .select()
      .from(edgeHeartbeatsTable)
      .where(eq(edgeHeartbeatsTable.deviceId, deviceId))
      .orderBy(sql`ts DESC`);
  }
  async createHeartbeat(data: InsertHeartbeat): Promise<EdgeHeartbeat> {
    const r = await db.insert(edgeHeartbeatsTable).values(data as never).returning();
    if (!r[0]) throw new Error("Failed to create heartbeat");
    return r[0];
  }
  async getPdmScores(equipmentId?: string, orgId?: string): Promise<PdmScoreLog[]> {
    if (equipmentId) {
      return db
        .select()
        .from(pdmScoreLogsTable)
        .where(eq(pdmScoreLogsTable.equipmentId, equipmentId))
        .orderBy(sql`ts DESC`);
    }
    return db
      .select()
      .from(pdmScoreLogsTable)
      .orderBy(sql`ts DESC`);
  }
  async createPdmScore(data: InsertPdmScore): Promise<PdmScoreLog> {
    const r = await db.insert(pdmScoreLogsTable).values(data).returning();
    if (!r[0]) throw new Error("Failed to create PDM score");
    return r[0];
  }
  async getLatestPdmScore(equipmentId: string): Promise<PdmScoreLog | undefined> {
    const r = await db
      .select()
      .from(pdmScoreLogsTable)
      .where(eq(pdmScoreLogsTable.equipmentId, equipmentId))
      .orderBy(sql`ts DESC`)
      .limit(1);
    return r[0];
  }
  async getHeartbeat(deviceId: string): Promise<EdgeHeartbeat | undefined> {
    const r = await db
      .select()
      .from(edgeHeartbeatsTable)
      .where(eq(edgeHeartbeatsTable.deviceId, deviceId))
      .orderBy(sql`ts DESC`)
      .limit(1);
    return r[0];
  }
  async upsertHeartbeat(heartbeat: InsertHeartbeat): Promise<EdgeHeartbeat> {
    const r = await db
      .insert(edgeHeartbeatsTable)
      .values(heartbeat as never)
      .onConflictDoUpdate({
        target: [edgeHeartbeatsTable.deviceId],
        set: { ...heartbeat, ts: new Date() } as never,
      })
      .returning();
    if (!r[0]) throw new Error("Failed to upsert edge heartbeat");
    return r[0];
  }
  async getDevicesWithStatus(
    orgId?: string
  ): Promise<Array<Device & { status: string; lastHeartbeat?: EdgeHeartbeat | undefined }>> {
    const deviceList = await this.getDevices(orgId);
    const heartbeats = await this.getHeartbeatsByOrg(orgId);
    return deviceList.map((device) => {
      const hb = heartbeats.find((x) => x.deviceId === device.id);
      let status = "Offline";
      if (hb) {
        const timeDiff = Date.now() - (hb.ts?.getTime() || 0);
        if (timeDiff < 5 * 60 * 1000) {
          if ((hb.cpuPct || 0) > 90 || (hb.memPct || 0) > 90 || (hb.diskFreeGb || 0) < 5) {
            status = "Critical";
          } else if ((hb.cpuPct || 0) > 80 || (hb.memPct || 0) > 80 || (hb.diskFreeGb || 0) < 10) {
            status = "Warning";
          } else {
            status = "Online";
          }
        }
      }
      return { ...device, status, lastHeartbeat: hb };
    });
  }
}

export class MemDevicesStorage {
  private devices: Map<string, Device> = new Map();
  private heartbeats: Map<string, EdgeHeartbeat[]> = new Map();
  private pdmScores: Map<string, PdmScoreLog[]> = new Map();
  async getDevices(orgId?: string): Promise<Device[]> {
    return Array.from(this.devices.values()).filter((d) => !orgId || d.orgId === orgId);
  }
  async getDevice(id: string, orgId?: string): Promise<Device | undefined> {
    const d = this.devices.get(id);
    return d && (!orgId || d.orgId === orgId) ? d : undefined;
  }
  async createDevice(data: InsertDevice): Promise<Device> {
    const d = { ...data, id: data.id || crypto.randomUUID() } as Device;
    this.devices.set(d.id, d);
    return d;
  }
  async updateDevice(
    id: string,
    data: WidenPartial<InsertDevice>,
    orgId?: string
  ): Promise<Device | undefined> {
    const d = await this.getDevice(id, orgId);
    if (d) {
      const upd = { ...d, ...data } as Device;
      this.devices.set(id, upd);
      return upd;
    }
    return undefined;
  }
  async deleteDevice(id: string, orgId?: string): Promise<boolean> {
    const d = await this.getDevice(id, orgId);
    if (d) {
      this.devices.delete(id);
      return true;
    }
    return false;
  }
  async getHeartbeatsByOrg(orgId?: string): Promise<EdgeHeartbeat[]> {
    return Array.from(this.heartbeats.values())
      .flat()
      .filter((h) => !orgId || h.orgId === orgId);
  }
  async getHeartbeats(deviceId: string, orgId?: string): Promise<EdgeHeartbeat[]> {
    return (this.heartbeats.get(deviceId) || []).filter((h) => !orgId || h.orgId === orgId);
  }
  async createHeartbeat(data: InsertHeartbeat): Promise<EdgeHeartbeat> {
    const h = { ...data, ts: new Date() } as never as EdgeHeartbeat;
    const deviceId = (data as never as { deviceId: string }).deviceId;
    const arr = this.heartbeats.get(deviceId) || [];
    arr.push(h);
    this.heartbeats.set(deviceId, arr);
    return h;
  }
  async getPdmScores(equipmentId?: string, orgId?: string): Promise<PdmScoreLog[]> {
    if (equipmentId) {
      return (this.pdmScores.get(equipmentId) || []).filter((s) => !orgId || s.orgId === orgId);
    }
    return Array.from(this.pdmScores.values())
      .flat()
      .filter((s) => !orgId || s.orgId === orgId);
  }
  async createPdmScore(data: InsertPdmScore): Promise<PdmScoreLog> {
    const s = { ...data, id: crypto.randomUUID(), ts: new Date() } as PdmScoreLog;
    const arr = this.pdmScores.get(data.equipmentId) || [];
    arr.push(s);
    this.pdmScores.set(data.equipmentId, arr);
    return s;
  }
}

export const dbDevicesStorage = new DatabaseDevicesStorage();
export const memDevicesStorage = new MemDevicesStorage();
