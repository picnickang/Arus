export interface VesselRecord {
  id?: string;
  name?: string;
  vesselName?: string;
  imo?: string;
  status?: string;
  currentPort?: string;
  route?: string;
}

export interface EquipmentRecord {
  id?: string;
  equipmentId?: string;
  vesselId?: string;
  name?: string;
  equipmentName?: string;
  assetCode?: string;
  tagNumber?: string;
  status?: string;
  healthStatus?: string;
  system?: string;
  sectionKey?: string;
}

export interface WorkOrderRecord {
  id?: string;
  vesselId?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  equipmentId?: string;
  dueDate?: string;
}

export interface AlertRecord {
  id?: string;
  vesselId?: string;
  title?: string;
  message?: string;
  severity?: string;
  status?: string;
  acknowledged?: boolean;
}

export type PdmDashboardRecord = Record<string, unknown>;

export function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  for (const key of ["data", "items", "results", "vessels", "equipment", "workOrders", "alerts"]) {
    const maybeArray = record[key];
    if (Array.isArray(maybeArray)) {
      return maybeArray as T[];
    }
  }

  return [];
}

export function vesselIdFor(vessel: VesselRecord | undefined): string {
  return vessel?.id ?? "";
}

export function vesselNameFor(vessel: VesselRecord | undefined): string {
  return vessel?.name ?? vessel?.vesselName ?? vessel?.id ?? "No vessel selected";
}

export function equipmentNameFor(equipment: EquipmentRecord): string {
  return (
    equipment.name ?? equipment.equipmentName ?? equipment.assetCode ?? equipment.id ?? "Equipment"
  );
}

export function workOrderTitleFor(workOrder: WorkOrderRecord): string {
  return workOrder.title ?? workOrder.description ?? workOrder.id ?? "Work order";
}

export function alertTitleFor(alert: AlertRecord): string {
  return alert.title ?? alert.message ?? alert.id ?? "Alert";
}

export function belongsToVessel(record: { vesselId?: string }, vesselId: string): boolean {
  if (!vesselId) {
    return true;
  }
  return !record.vesselId || record.vesselId === vesselId;
}

export function statusText(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return "Live data unavailable";
}
