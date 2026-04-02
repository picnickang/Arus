/**
 * Search Service - Entity Searches
 * Individual entity search implementations
 */

import { db } from "../db.js";
import { vessels, equipment, alertNotifications, workOrders, crew, sensorConfigurations } from "@shared/schema-runtime";
import { eq, or, ilike, and, sql } from "drizzle-orm";
import type { SearchResult } from "../../shared/search.js";

function sqlArray(ids: string[]) {
  return sql`ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::text[]`;
}

export async function searchVessels(query: string, orgId: string, limit: number): Promise<SearchResult[]> {
  const pattern = `%${query}%`;
  const results = await db.select({ id: vessels.id, name: vessels.name, type: vessels.type, imo: vessels.imo, flag: vessels.flag, status: vessels.status })
    .from(vessels).where(and(eq(vessels.orgId, orgId), or(ilike(vessels.name, pattern), ilike(vessels.imo, pattern), ilike(vessels.type, pattern)))).limit(limit);
  return results.map((v) => ({ id: v.id, entityType: "vessel" as const, name: v.name, description: `${v.type} - IMO: ${v.imo || "N/A"}`, status: v.status || undefined, metadata: { type: v.type || undefined, imo: v.imo || undefined, flag: v.flag || undefined } }));
}

export async function searchEquipment(query: string, orgId: string, limit: number): Promise<SearchResult[]> {
  const pattern = `%${query}%`;
  const results = await db.select({ id: equipment.id, name: equipment.name, type: equipment.type, vesselId: equipment.vesselId, manufacturer: equipment.manufacturer, model: equipment.model })
    .from(equipment).where(and(eq(equipment.orgId, orgId), or(ilike(equipment.name, pattern), ilike(equipment.type, pattern), ilike(equipment.manufacturer, pattern), ilike(equipment.model, pattern)))).limit(limit);

  const vesselIds = [...new Set(results.map((e) => e.vesselId).filter(Boolean))];
  const vesselMap = new Map<string, string>();
  if (vesselIds.length > 0) {
    const vesselData = await db.select({ id: vessels.id, name: vessels.name }).from(vessels).where(and(eq(vessels.orgId, orgId), sql`${vessels.id} = ANY(${sqlArray(vesselIds as string[])})`));
    vesselData.forEach((v) => vesselMap.set(v.id, v.name));
  }
  return results.map((e) => ({ id: e.id, entityType: "equipment" as const, name: e.name, description: `${e.type} - ${e.manufacturer || ""} ${e.model || ""}`.trim(), status: e.vesselId ? "active" : "inactive", metadata: { type: e.type || undefined, vesselId: e.vesselId || undefined, vesselName: e.vesselId ? vesselMap.get(e.vesselId) : undefined } }));
}

export async function searchAlerts(query: string, orgId: string, limit: number): Promise<SearchResult[]> {
  const pattern = `%${query}%`;
  const results = await db.select({ id: alertNotifications.id, message: alertNotifications.message, severity: alertNotifications.severity, equipmentId: alertNotifications.equipmentId, acknowledged: alertNotifications.acknowledged, createdAt: alertNotifications.createdAt })
    .from(alertNotifications).where(and(eq(alertNotifications.orgId, orgId), ilike(alertNotifications.message, pattern))).orderBy(sql`${alertNotifications.createdAt} DESC`).limit(limit);

  const equipmentIds = [...new Set(results.map((a) => a.equipmentId).filter(Boolean))];
  const equipmentMap = new Map<string, string>();
  if (equipmentIds.length > 0) {
    const equipmentData = await db.select({ id: equipment.id, name: equipment.name }).from(equipment).where(and(eq(equipment.orgId, orgId), sql`${equipment.id} = ANY(${sqlArray(equipmentIds as string[])})`));
    equipmentData.forEach((e) => equipmentMap.set(e.id, e.name));
  }
  return results.map((a) => ({ id: a.id, entityType: "alert" as const, name: a.message.substring(0, 50) + (a.message.length > 50 ? "..." : ""), description: a.message, status: a.acknowledged ? "acknowledged" : "active", metadata: { severity: a.severity as "info" | "warning" | "critical", equipmentId: a.equipmentId || undefined, equipmentName: a.equipmentId ? equipmentMap.get(a.equipmentId) : undefined, acknowledged: a.acknowledged } }));
}

export async function searchWorkOrders(query: string, orgId: string, limit: number): Promise<SearchResult[]> {
  const pattern = `%${query}%`;
  const results = await db.select({ id: workOrders.id, title: workOrders.title, description: workOrders.description, status: workOrders.status, priority: workOrders.priority, equipmentId: workOrders.equipmentId, dueDate: workOrders.dueDate })
    .from(workOrders).where(and(eq(workOrders.orgId, orgId), or(ilike(workOrders.title, pattern), ilike(workOrders.description, pattern)))).limit(limit);

  const equipmentIds = [...new Set(results.map((w) => w.equipmentId).filter(Boolean))];
  const equipmentMap = new Map<string, string>();
  if (equipmentIds.length > 0) {
    const equipmentData = await db.select({ id: equipment.id, name: equipment.name }).from(equipment).where(and(eq(equipment.orgId, orgId), sql`${equipment.id} = ANY(${sqlArray(equipmentIds as string[])})`));
    equipmentData.forEach((e) => equipmentMap.set(e.id, e.name));
  }
  return results.map((w) => ({ id: w.id, entityType: "work-order" as const, name: w.title, description: w.description || undefined, status: w.status, metadata: { priority: w.priority ? String(w.priority) : undefined, equipmentId: w.equipmentId || undefined, equipmentName: w.equipmentId ? equipmentMap.get(w.equipmentId) : undefined, dueDate: w.dueDate || undefined } }));
}

export async function searchCrew(query: string, orgId: string, limit: number): Promise<SearchResult[]> {
  const pattern = `%${query}%`;
  const results = await db.select({ id: crew.id, firstName: crew.firstName, lastName: crew.lastName, rank: crew.rank, role: crew.role, vesselId: crew.vesselId, status: crew.status })
    .from(crew).where(and(eq(crew.orgId, orgId), or(ilike(crew.firstName, pattern), ilike(crew.lastName, pattern), ilike(crew.rank, pattern), ilike(crew.role, pattern)))).limit(limit);

  const vesselIds = [...new Set(results.map((c) => c.vesselId).filter(Boolean))];
  const vesselMap = new Map<string, string>();
  if (vesselIds.length > 0) {
    const vesselData = await db.select({ id: vessels.id, name: vessels.name }).from(vessels).where(and(eq(vessels.orgId, orgId), sql`${vessels.id} = ANY(${sqlArray(vesselIds as string[])})`));
    vesselData.forEach((v) => vesselMap.set(v.id, v.name));
  }
  return results.map((c) => ({ id: c.id, entityType: "crew" as const, name: `${c.firstName} ${c.lastName}`, description: `${c.rank || "Crew"} - ${c.role || "N/A"}`, status: c.status || undefined, metadata: { role: c.role || undefined, rank: c.rank || undefined, vesselId: c.vesselId || undefined, vesselName: c.vesselId ? vesselMap.get(c.vesselId) : undefined } }));
}

export async function searchSensors(query: string, orgId: string, limit: number): Promise<SearchResult[]> {
  const pattern = `%${query}%`;
  const results = await db.select({ id: sensorConfigurations.id, sensorName: sensorConfigurations.sensorName, sensorType: sensorConfigurations.sensorType, unit: sensorConfigurations.unit, equipmentId: sensorConfigurations.equipmentId })
    .from(sensorConfigurations).where(and(eq(sensorConfigurations.orgId, orgId), or(ilike(sensorConfigurations.sensorName, pattern), ilike(sensorConfigurations.sensorType, pattern)))).limit(limit);

  const equipmentIds = [...new Set(results.map((s) => s.equipmentId).filter(Boolean))];
  const equipmentMap = new Map<string, string>();
  if (equipmentIds.length > 0) {
    const equipmentData = await db.select({ id: equipment.id, name: equipment.name }).from(equipment).where(and(eq(equipment.orgId, orgId), sql`${equipment.id} = ANY(${sqlArray(equipmentIds as string[])})`));
    equipmentData.forEach((e) => equipmentMap.set(e.id, e.name));
  }
  return results.map((s) => ({ id: s.id, entityType: "sensor" as const, name: s.sensorName, description: `${s.sensorType} (${s.unit})`, metadata: { equipmentId: s.equipmentId || undefined, equipmentName: s.equipmentId ? equipmentMap.get(s.equipmentId) : undefined, sensorType: s.sensorType || undefined, unit: s.unit || undefined } }));
}
