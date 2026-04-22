import { Equipment, Vessel } from "@shared/schema";
import { EquipmentFilters } from "@/hooks/useEquipmentFilters";

/**
 * Filter equipment based on search and filter criteria
 */
export function filterEquipment(allEquipment: Equipment[], filters: EquipmentFilters): Equipment[] {
  return allEquipment.filter((equipment) => {
    // Search filter (case-insensitive, matches name, type, manufacturer, vesselName)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        equipment.name?.toLowerCase().includes(searchLower) ||
        equipment.type?.toLowerCase().includes(searchLower) ||
        equipment.manufacturer?.toLowerCase().includes(searchLower) ||
        equipment.vesselName?.toLowerCase().includes(searchLower);

      if (!matchesSearch) {
        return false;
      }
    }

    // Vessel filter
    if (filters.vessel !== "all" && equipment.vesselId !== filters.vessel) {
      return false;
    }

    // Type filter
    if (filters.type !== "all" && equipment.type !== filters.type) {
      return false;
    }

    // Status filter (active/inactive)
    if (filters.status !== "all") {
      const isActive = equipment.isActive;
      if (filters.status === "active" && !isActive) {
        return false;
      }

      if (filters.status === "inactive" && isActive) {
        return false;
      }
    }

    // Manufacturer filter
    if (filters.manufacturer !== "all" && equipment.manufacturer !== filters.manufacturer) {
      return false;
    }

    return true;
  });
}

/**
 * Format location string from snake_case to Title Case
 */
export function formatLocation(location: string): string {
  return location.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Format equipment type from snake_case to Title Case
 */
export function formatType(type: string): string {
  return type.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Get vessel information for an equipment item
 */
export function getVesselInfo(equipment: Equipment, vessels: Vessel[]) {
  // Equipment is properly linked if it has a vesselId (foreign key)
  if (equipment.vesselId) {
    const vessel = vessels.find((v) => v.id === equipment.vesselId);
    // If vessel is found in database, it's properly linked
    // If not found, it means the vessel was deleted but vesselId still references it (orphaned link)
    if (vessel) {
      return { name: vessel.name, id: vessel.id, isLinked: true };
    }
    // Orphaned vesselId - vessel was deleted
    return { name: equipment.vesselName || "Unknown", id: equipment.vesselId, isLinked: false };
  }
  // Equipment is not linked but may have a legacy vesselName (data migration artifact)
  if (equipment.vesselName) {
    // Check if a vessel exists with this name for potential linking
    const vessel = vessels.find((v) => v.name === equipment.vesselName);
    return vessel
      ? { name: vessel.name, id: vessel.id, isLinked: true }
      : { name: equipment.vesselName, id: null, isLinked: false };
  }
  // Equipment is not assigned to any vessel
  return { name: null, id: null, isLinked: false };
}

/**
 * Get equipment status type for StatusBadge component
 */
export function getEquipmentStatus(equipment: Equipment): "active" | "inactive" {
  return equipment.isActive ? "active" : "inactive";
}

/**
 * Calculate equipment statistics from a list of equipment
 */
export function calculateEquipmentStats(
  allEquipment: Equipment[],
  vessels: Vessel[],
  filteredCount?: number
) {
  const activeCount = allEquipment.filter((e) => e.isActive).length;
  const inactiveCount = allEquipment.length - activeCount;
  const unassignedCount = allEquipment.filter((e) => !e.vesselId).length;

  // Group by vessel
  const byVessel = allEquipment.reduce((acc: Record<string, number>, e: Equipment) => {
    if (e.vesselId) {
      const vessel = vessels.find((v) => v.id === e.vesselId);
      const vesselName = vessel?.name || "Unknown";
      acc[vesselName] = (acc[vesselName] || 0) + 1;
    }
    return acc;
  }, {});

  const vesselCount = Object.keys(byVessel).length;

  return {
    total: allEquipment.length,
    active: activeCount,
    inactive: inactiveCount,
    unassigned: unassignedCount,
    vesselCount,
    filtered: filteredCount ?? allEquipment.length,
  };
}
