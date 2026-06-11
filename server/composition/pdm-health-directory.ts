/**
 * Composition seam for the pdm-platform health route's cross-domain reads
 * (equipment health from the equipment domain, PdM scores from devices).
 * Routes layers may not reference `db*Storage` directly (domain-leak guard);
 * this is the sanctioned wiring point.
 */
import { dbEquipmentStorage, dbDevicesStorage } from "../repositories.js";

export const pdmHealthDirectory = {
  getEquipmentHealth: (...args: Parameters<typeof dbEquipmentStorage.getEquipmentHealth>) =>
    dbEquipmentStorage.getEquipmentHealth(...args),
  getPdmScores: (...args: Parameters<typeof dbDevicesStorage.getPdmScores>) =>
    dbDevicesStorage.getPdmScores(...args),
};
