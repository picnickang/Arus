/**
 * Composition seam for the optimization dashboard's cross-domain reads.
 *
 * The scheduling domain's `/api/optimization/dashboard` aggregate needs the
 * equipment registry and vessel list, but the domain may neither import the
 * equipment domain directly (cross-domain boundary guard) nor reference
 * `db*Storage` from its routes layer (domain-leak guard). This module wires
 * the equipment domain's public repository — same call chain as before —
 * and the vessels storage to scheduling from outside the domain tree.
 */
import { equipmentRepository } from "../domains/equipment/repository.js";
import { dbVesselStorage } from "../db/vessels/index.js";

export const optimizationDirectory = {
  listEquipmentRegistry: (orgId: string) => equipmentRepository.findAll(orgId),
  listVessels: (orgId: string) => dbVesselStorage.getVessels(orgId),
};
