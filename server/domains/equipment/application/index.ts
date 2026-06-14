/**
 * Equipment Application Layer - DI Composition Root (lifecycle slice)
 */

import { EquipmentLifecycleService } from "./lifecycle-service";
import { equipmentLifecycleRepository } from "../infrastructure/lifecycle-repository-adapter";

export const equipmentLifecycleService = new EquipmentLifecycleService(equipmentLifecycleRepository);

export { EquipmentLifecycleService } from "./lifecycle-service";
