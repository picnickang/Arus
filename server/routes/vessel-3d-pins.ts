/**
 * Push A3 — equipment-pin narrowing for the 3D Digital Twin viewer.
 *
 * P2 #33 — Validate the `equipment_pins` JSONB column at the route
 * boundary. Writes already go through `pinsSchema`, but historical
 * rows (and any direct SQL fix) are typed `unknown` by drizzle's
 * jsonb. We narrow on read so the JSON returned to the 3D viewer
 * carries the documented `{equipmentId,x,y,z,label?}[]` contract.
 * A malformed row degrades to `[]` with a warning instead of
 * throwing — the model render still works without phantom pins.
 */

import { equipmentPinSchema, type EquipmentPin, type Vessel3dModel } from "@shared/schema-runtime";
import { z } from "zod";
import { createLogger } from "../lib/structured-logger";

const logger = createLogger("Routes:Vessel3D");

const equipmentPinsReadSchema = z.array(equipmentPinSchema);
export function narrowEquipmentPins(value: unknown): EquipmentPin[] {
  if (value === null || value === undefined) {
    return [];
  }
  const parsed = equipmentPinsReadSchema.safeParse(value);
  if (!parsed.success) {
    logger.warn("Discarding malformed vessel_3d_models.equipment_pins JSONB", {
      issues: parsed.error.issues.slice(0, 3),
    });
    return [];
  }
  return parsed.data;
}
export function narrowVessel3dModel<T extends Vessel3dModel>(row: T): T {
  return { ...row, equipmentPins: narrowEquipmentPins(row.equipmentPins) };
}
