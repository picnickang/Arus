/**
 * Work Order Repository Adapter
 * Implements IWorkOrderRepository port
 */

import type { IWorkOrderRepository } from "../domain/ports";
import { workOrderRepository as legacyRepository } from "../repository";

export const workOrderRepoAdapter: IWorkOrderRepository = {
  findAll: (orgId, vesselId) => legacyRepository.findAll(orgId ?? "", vesselId),
  findById: (id, orgId) => legacyRepository.findById(id, orgId ?? ""),
  findByCriteria: async (criteria) => {
    return legacyRepository.findAll(criteria.orgId!, criteria.vesselId ?? undefined);
  },
  create: (data) => legacyRepository.create(data),
  update: (id, data) => legacyRepository.update(id, data),
  delete: (id) => legacyRepository.delete(id),
  findByEquipment: (equipmentId) => (legacyRepository as any).findByEquipment(equipmentId),
  findOverdue: async (orgId) => {
    const all = await legacyRepository.findAll(orgId);
    const now = new Date();
    return all.filter(
      (wo: any) => wo.dueDate && new Date(wo.dueDate) < now && wo.status !== "completed"
    );
  },
};
