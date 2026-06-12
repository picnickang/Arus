import { createLogger } from "../../lib/structured-logger";
import { projectEquipment, retractInstalledOn } from "../../graph/projector";

const logger = createLogger("Db:Equipment:DbEquipment");

interface EquipmentGraphRow {
  id: string;
  orgId?: string | null;
  name: string;
  type: string;
  vesselId?: string | null;
  systemType?: string | null;
}

function toEquipmentProjection(row: EquipmentGraphRow) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    vesselId: row.vesselId ?? null,
    systemType: row.systemType ?? null,
  };
}

export async function projectCreatedEquipment(row: EquipmentGraphRow): Promise<void> {
  try {
    if (!row.orgId) {
      throw new Error("missing orgId");
    }
    await projectEquipment(row.orgId, toEquipmentProjection(row));
  } catch (err) {
    logger.warn(`[Graph] projectEquipment(${row.id}) failed`, {
      orgId: row.orgId,
      details: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function syncUpdatedEquipment(
  row: EquipmentGraphRow,
  priorVesselId: string | null
): Promise<void> {
  try {
    if (row.orgId) {
      if (priorVesselId && priorVesselId !== row.vesselId) {
        await retractInstalledOn(row.orgId, row.id, priorVesselId);
      }
      await projectEquipment(row.orgId, toEquipmentProjection(row));
    }
  } catch (err) {
    logger.warn(`[Graph] projectEquipment(${row.id}) on update failed`, {
      orgId: row.orgId,
      details: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function syncAssociatedEquipment(
  orgId: string,
  equipmentId: string,
  row: EquipmentGraphRow,
  priorVesselId: string | null,
  vesselId: string
): Promise<void> {
  try {
    if (priorVesselId && priorVesselId !== vesselId) {
      await retractInstalledOn(orgId, equipmentId, priorVesselId);
    }
    await projectEquipment(orgId, toEquipmentProjection(row));
  } catch (err) {
    logger.warn(`[Graph] projectEquipment(${equipmentId}) on associate failed`, {
      orgId,
      details: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function retractDisassociatedEquipment(
  orgId: string,
  equipmentId: string,
  priorVesselId: string | null
): Promise<void> {
  if (!priorVesselId) {
    return;
  }

  try {
    await retractInstalledOn(orgId, equipmentId, priorVesselId);
  } catch (err) {
    logger.warn(`[Graph] retractInstalledOn(${equipmentId}) on disassociate failed`, {
      orgId,
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
