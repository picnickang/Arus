import { useQuery } from "@tanstack/react-query";

interface Equipment {
  id: string;
  name?: string;
  type?: string;
  vesselId?: string;
}

interface Vessel { id: string; name: string; }

export function useEquipmentName(equipmentId: string) {
  const { data: equipment = [] } = useQuery<Equipment[]>({ queryKey: ["/api/equipment"] });
  if (!equipmentId) {return "";}
  const eq = equipment.find((e) => e.id === equipmentId);
  return eq?.name || equipmentId;
}

export function useEquipmentVesselName(equipmentId: string) {
  const { data: equipment = [] } = useQuery<Equipment[]>({ queryKey: ["/api/equipment"] });
  const { data: vessels = [] } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  if (!equipmentId) {return null;}
  const eq = equipment.find((e) => e.id === equipmentId);
  if (!eq?.vesselId) {return null;}
  const v = vessels.find((vessel) => vessel.id === eq.vesselId);
  return v?.name || null;
}

export function useEquipmentLookup() {
  const { data: equipment = [] } = useQuery<Equipment[]>({ queryKey: ["/api/equipment"] });
  const { data: vessels = [] } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  
  function resolve(equipmentId: string) {
    if (!equipmentId) {return { name: equipmentId, vessel: null };}
    const eq = equipment.find((e) => e.id === equipmentId);
    const name = eq?.name || equipmentId;
    let vessel: string | null = null;
    if (eq?.vesselId) {
      const v = vessels.find((ves) => ves.id === eq.vesselId);
      vessel = v?.name || null;
    }
    return { name, vessel };
  }
  
  return { resolve, equipment, vessels };
}
