import { eq } from "drizzle-orm";
import type { WidenPartial } from "../../lib/widen-partial";
import { db } from "../../db";
import { drydockWindow, portCall } from "@shared/schema-runtime";
import type {
  DrydockWindow as SelectDrydockWindow,
  InsertDrydockWindow,
  InsertPortCall,
  PortCall as SelectPortCall,
} from "@shared/schema";

export async function getPortCalls(vesselId?: string): Promise<SelectPortCall[]> {
  let q = db.select().from(portCall).$dynamic();
  if (vesselId) {
    q = q.where(eq(portCall.vesselId, vesselId));
  }
  return q.orderBy(portCall.start);
}

export async function createPortCall(portCallData: InsertPortCall): Promise<SelectPortCall> {
  const [n] = await db.insert(portCall).values(portCallData).returning();
  if (!n) {
    throw new Error("createPortCall: insert returned no row");
  }
  return n;
}

export async function updatePortCall(
  id: string,
  portCallData: WidenPartial<InsertPortCall>
): Promise<SelectPortCall> {
  const [u] = await db.update(portCall).set(portCallData).where(eq(portCall.id, id)).returning();
  if (!u) {
    throw new Error(`Port call ${id} not found`);
  }
  return u;
}

export async function deletePortCall(id: string): Promise<void> {
  const r = await db.delete(portCall).where(eq(portCall.id, id));
  if (r.rowCount === 0) {
    throw new Error(`Port call ${id} not found`);
  }
}

export async function getDrydockWindows(vesselId?: string): Promise<SelectDrydockWindow[]> {
  let q = db.select().from(drydockWindow).$dynamic();
  if (vesselId) {
    q = q.where(eq(drydockWindow.vesselId, vesselId));
  }
  return q.orderBy(drydockWindow.start);
}

export async function createDrydockWindow(
  drydockData: InsertDrydockWindow
): Promise<SelectDrydockWindow> {
  const [n] = await db.insert(drydockWindow).values(drydockData).returning();
  if (!n) {
    throw new Error("createDrydockWindow: insert returned no row");
  }
  return n;
}

export async function updateDrydockWindow(
  id: string,
  drydockData: WidenPartial<InsertDrydockWindow>
): Promise<SelectDrydockWindow> {
  const [u] = await db
    .update(drydockWindow)
    .set(drydockData)
    .where(eq(drydockWindow.id, id))
    .returning();
  if (!u) {
    throw new Error(`Drydock window ${id} not found`);
  }
  return u;
}

export async function deleteDrydockWindow(id: string): Promise<void> {
  const r = await db.delete(drydockWindow).where(eq(drydockWindow.id, id));
  if (r.rowCount === 0) {
    throw new Error(`Drydock window ${id} not found`);
  }
}
