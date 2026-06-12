export function createEquipmentLookup(
  equipment: Array<{ id: string; name?: string }>
): Map<string, string> {
  return new Map(equipment.map((eq) => [eq.id, eq.name || eq.id]));
}

export function createVesselLookup(
  vessels: Array<{ id: string; name: string }>
): Map<string, string> {
  return new Map(vessels.map((v) => [v.id, v.name]));
}

export function lookupName(map: Map<string, string>, id: string): string {
  return map.get(id) || id;
}
