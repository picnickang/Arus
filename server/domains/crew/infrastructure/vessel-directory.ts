/**
 * Vessel directory adapter for crew interfaces.
 *
 * The unified crew endpoint returns the vessel list for roster display.
 * Raw db access belongs in the infrastructure layer, not in interfaces
 * (hex-storage and domain-leak guards), so the lookup lives here.
 */
import { dbVesselStorage } from "../../../db/vessels/index.js";

export function listVesselsDirectory(orgId: string) {
  return dbVesselStorage.getVessels(orgId);
}
