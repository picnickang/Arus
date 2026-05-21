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
  findByEquipment: (equipmentId) =>
    (
      legacyRepository as object as {
        findByEquipment: (id: string) => ReturnType<IWorkOrderRepository["findAll"]>;
      }
    ).findByEquipment(equipmentId),
  findOverdue: async (orgId) => {
    const all = await legacyRepository.findAll(orgId);
    const now = new Date();
    return all.filter((wo) => {
      const bag = wo as object as { dueDate?: Date | string | null; status?: string };
      return bag.dueDate && new Date(bag.dueDate) < now && bag.status !== "completed";
    });
  },
};
