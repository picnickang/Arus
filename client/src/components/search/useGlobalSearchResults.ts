import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";

export interface VesselResult {
  id: string;
  name: string;
}
export interface EquipmentResult {
  id: string;
  name: string;
  vesselId?: string | null;
}
export interface WorkOrderResult {
  id: string;
  woNumber?: string | null;
  reason?: string | null;
  description?: string | null;
  status?: string | null;
}

const MIN_QUERY_LENGTH = 2;

export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.toLowerCase();
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}

/**
 * Debounced, org-scoped (server-side) result sets for the global palette.
 * Equipment searches server-side via ?q=; vessels and work orders are
 * small-to-moderate lists cached long and filtered client-side.
 */
export function useGlobalSearchResults(query: string, enabled: boolean) {
  const debounced = useDebounce(query.trim(), 300);
  const active = enabled && debounced.length >= MIN_QUERY_LENGTH;

  const { data: equipment = [] } = useQuery<EquipmentResult[]>({
    queryKey: ["/api/equipment", { q: debounced }],
    enabled: active,
    staleTime: 30_000,
  });
  const { data: vessels = [] } = useQuery<VesselResult[]>({
    queryKey: ["/api/vessels"],
    enabled: active,
    staleTime: 5 * 60 * 1000,
  });
  const { data: workOrders = [] } = useQuery<WorkOrderResult[]>({
    queryKey: ["/api/work-orders"],
    enabled: active,
    staleTime: 60_000,
  });

  const vesselMatches = active
    ? vessels.filter((v) => matchesQuery(debounced, v.name)).slice(0, 4)
    : [];
  const equipmentMatches = active ? (Array.isArray(equipment) ? equipment : []).slice(0, 5) : [];
  const workOrderMatches = active
    ? workOrders
        .filter((wo) => matchesQuery(debounced, wo.woNumber, wo.reason, wo.description))
        .slice(0, 4)
    : [];

  return { active, debounced, vesselMatches, equipmentMatches, workOrderMatches };
}
