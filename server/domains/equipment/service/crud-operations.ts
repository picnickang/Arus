/**
 * Equipment Service - CRUD Operations
 */

import type { Equipment, InsertEquipment } from "@shared/schema";
import { logger } from "../../../utils/logger.js";
import { equipmentRepository } from "../repository";
import { recordAndPublish } from "../../../sync-events";
import { mqttReliableSync } from "../../../mqtt-reliable-sync";
import { DualWriteAdapter, ConsistencyChecks } from "../../../infrastructure/DualWriteAdapter";
import { TenantRepositoryFactory } from "../../../infrastructure/TenantScopedRepository";
import { featureFlags } from "../../../infrastructure/feature-flags";
import { equipmentAnalyticsService } from "../../../equipment-analytics-service";
import type { PaginationOptions, PaginatedResult } from "./types.js";

export function createAdapter(): DualWriteAdapter {
  return new DualWriteAdapter({
    featureFlag: () => featureFlags.isEnabled("useTenantScopedEquipment"),
    domain: "equipment",
  });
}

export async function listEquipment(
  adapter: DualWriteAdapter,
  orgId: string
): Promise<Equipment[]> {
  return adapter.execute({
    operation: "getAll",
    repositoryFn: async () => {
      const repo = TenantRepositoryFactory.equipment(orgId);
      return repo.getAll();
    },
    legacyFn: () => equipmentRepository.findAll(orgId),
    consistencyCheck: ConsistencyChecks.arrayLength,
  });
}

export async function listEquipmentPaginated(
  adapter: DualWriteAdapter,
  orgId: string,
  options: PaginationOptions
): Promise<PaginatedResult<Equipment>> {
  const allEquipment = await listEquipment(adapter, orgId);

  const filteredEquipment = allEquipment.filter((equipment: Equipment) => {
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      const matchesSearch =
        equipment.name.toLowerCase().includes(searchLower) ||
        (equipment.manufacturer && equipment.manufacturer.toLowerCase().includes(searchLower)) ||
        (equipment.model && equipment.model.toLowerCase().includes(searchLower)) ||
        (equipment.serialNumber && equipment.serialNumber.toLowerCase().includes(searchLower));
      if (!matchesSearch) {
        return false;
      }
    }

    if (options.type && equipment.type !== options.type) {
      return false;
    }
    if (options.status === "active" && !equipment.isActive) {
      return false;
    }
    if (options.status === "inactive" && equipment.isActive) {
      return false;
    }
    if (options.vesselId && equipment.vesselId !== options.vesselId) {
      return false;
    }
    if (
      options.manufacturer &&
      (!equipment.manufacturer ||
        equipment.manufacturer.toLowerCase() !== options.manufacturer.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const total = filteredEquipment.length;
  const totalPages = Math.ceil(total / options.pageSize);
  const startIndex = (options.page - 1) * options.pageSize;
  const items = filteredEquipment.slice(startIndex, startIndex + options.pageSize);

  return { items, total, page: options.page, pageSize: options.pageSize, totalPages };
}

export async function getEquipmentById(
  adapter: DualWriteAdapter,
  equipmentId: string,
  orgId: string
): Promise<Equipment | undefined> {
  return adapter.execute({
    operation: "getById",
    repositoryFn: async () => {
      const repo = TenantRepositoryFactory.equipment(orgId);
      return repo.getById(equipmentId);
    },
    legacyFn: () => equipmentRepository.findById(equipmentId, orgId),
    consistencyCheck: ConsistencyChecks.objectById,
  });
}

export async function createEquipment(
  adapter: DualWriteAdapter,
  data: InsertEquipment,
  userId?: string
): Promise<Equipment> {
  const equipment = await adapter.execute({
    operation: "create",
    repositoryFn: async () => {
      const repo = TenantRepositoryFactory.equipment(data.orgId ?? "");
      const { orgId: _, ...createData } = data;
      return repo.create(createData);
    },
    legacyFn: () => equipmentRepository.create(data),
    consistencyCheck: ConsistencyChecks.objectById,
  });

  try {
    await (
      equipmentAnalyticsService as object as {
        setupEquipmentAnalytics?: (e: typeof equipment) => Promise<unknown>;
      }
    ).setupEquipmentAnalytics?.(equipment);
    logger.info(
      "EquipmentService",
      `Analytics setup completed for equipment ${equipment.id} (type: ${equipment.type})`
    );
  } catch (error) {
    logger.error("EquipmentService", "Failed to setup equipment analytics", error);
  }

  await recordAndPublish("equipment", equipment.id, "create", equipment, userId);
  mqttReliableSync
    .publishEquipmentChange("create", equipment)
    .catch((err) => logger.error("EquipmentService", "Failed to publish to MQTT", err));
  return equipment;
}

export async function updateEquipment(
  adapter: DualWriteAdapter,
  id: string,
  data: Partial<InsertEquipment>,
  orgId: string,
  userId?: string
): Promise<Equipment> {
  const equipment = await adapter.execute({
    operation: "update",
    repositoryFn: async () => {
      const repo = TenantRepositoryFactory.equipment(orgId);
      return repo.update(id, data);
    },
    legacyFn: () => equipmentRepository.update(id, data, orgId),
    consistencyCheck: ConsistencyChecks.objectById,
  });

  await recordAndPublish("equipment", equipment.id, "update", equipment, userId);
  mqttReliableSync
    .publishEquipmentChange("update", equipment)
    .catch((err) => logger.error("EquipmentService", "Failed to publish to MQTT", err));
  return equipment;
}

export async function deleteEquipment(
  adapter: DualWriteAdapter,
  id: string,
  orgId: string,
  userId?: string
): Promise<void> {
  const equipment = await getEquipmentById(adapter, id, orgId);
  if (!equipment) {
    throw new Error("Equipment not found");
  }

  await adapter.execute({
    operation: "delete",
    repositoryFn: async () => {
      const repo = TenantRepositoryFactory.equipment(orgId);
      await repo.delete(id);
      return true;
    },
    legacyFn: async () => {
      await equipmentRepository.delete(id, orgId);
      return true;
    },
  });

  await recordAndPublish("equipment", id, "delete", { id }, userId);
  mqttReliableSync
    .publishEquipmentChange("delete", { id } as Equipment)
    .catch((err) => logger.error("EquipmentService", "Failed to publish to MQTT", err));
}

export async function disassociateVessel(
  adapter: DualWriteAdapter,
  equipmentId: string,
  orgId: string,
  userId?: string
): Promise<void> {
  const equipment = await adapter.execute({
    operation: "disassociateVessel",
    repositoryFn: async () => {
      const repo = TenantRepositoryFactory.equipment(orgId);
      const equipment = await repo.getById(equipmentId);
      if (!equipment) {
        throw new Error("Equipment not found");
      }
      return repo.update(equipmentId, { vesselId: null });
    },
    legacyFn: async () => {
      await equipmentRepository.disassociateVessel(equipmentId, orgId);
      return equipmentRepository.findById(equipmentId, orgId);
    },
    consistencyCheck: ConsistencyChecks.objectById,
  });

  if (equipment) {
    await recordAndPublish("equipment", equipmentId, "update", equipment, userId);
  }
}
