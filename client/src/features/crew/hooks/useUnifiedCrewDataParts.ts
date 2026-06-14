import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  type CrewListItem,
  type VesselListItem,
  type SortField,
  type SortDirection,
  type CrewAccessReadiness,
  type CrewAccessReadinessStatus,
  type FormerCrewAccessRisk,
  type FormerCrewAccessRiskFilter,
  filterCrew,
  sortCrew,
  countActiveFilters,
  type CrewManagementRole,
} from "../lib/crewManagementUtils";

/** Minimal shape of an RBAC permission role for the app-access pickers. */
export interface PermissionRoleOption {
  id: string;
  name: string;
  displayName?: string | null;
}

type UnifiedCrewDataResponse = {
  crew: CrewListItem[];
  vessels: VesselListItem[];
  crewRoles: CrewManagementRole[];
  permissionRoles: PermissionRoleOption[];
  sectionErrors?: Record<string, string>;
};

export function useCrewReferenceData() {
  // One aggregate request replaces the four parallel crew/vessels/crew-roles/
  // permission-roles queries (server: GET /api/crew/unified). The key keeps
  // "/api/crew" as its first segment so every existing invalidateQueries on
  // ["/api/crew"] refreshes the aggregate too.
  const { data: unifiedCrewData, isLoading: unifiedLoading } = useQuery<UnifiedCrewDataResponse>({
    queryKey: ["/api/crew", "unified"],
    queryFn: async () => {
      const { apiRequest } = await import("@/lib/queryClient");
      return apiRequest("GET", "/api/crew/unified");
    },
  });

  return {
    crew: unifiedCrewData?.crew ?? [],
    vessels: unifiedCrewData?.vessels ?? [],
    crewRoles: unifiedCrewData?.crewRoles ?? [],
    permissionRoles: unifiedCrewData?.permissionRoles ?? [],
    crewLoading: unifiedLoading,
    vesselsLoading: unifiedLoading,
    crewRolesLoading: unifiedLoading,
  };
}

export function useCrewAccessQueries(accessReadinessEnabled: boolean) {
  const {
    data: accessReadiness = [],
    isLoading: accessReadinessLoading,
    isError: accessReadinessError,
  } = useQuery<CrewAccessReadiness[]>({
    queryKey: ["/api/admin/crew/access-readiness"],
    enabled: accessReadinessEnabled,
    retry: false,
  });
  const {
    data: formerAccessRisks = [],
    isLoading: formerAccessRisksLoading,
    isError: formerAccessRisksError,
  } = useQuery<FormerCrewAccessRisk[]>({
    queryKey: ["/api/admin/crew/former-access-risks"],
    enabled: accessReadinessEnabled,
    retry: false,
  });

  return {
    accessReadiness,
    accessReadinessLoading,
    accessReadinessError,
    formerAccessRisks,
    formerAccessRisksLoading,
    formerAccessRisksError,
  };
}

export function useCrewAccessIndexes(
  accessReadiness: CrewAccessReadiness[],
  formerAccessRisks: FormerCrewAccessRisk[]
) {
  const accessReadinessByCrewId = useMemo(() => {
    const map = new Map<string, CrewAccessReadiness>();
    for (const item of accessReadiness) {
      map.set(item.crewId, item);
    }
    return map;
  }, [accessReadiness]);
  const formerAccessRiskByCrewId = useMemo(() => {
    const map = new Map<string, FormerCrewAccessRisk>();
    for (const item of formerAccessRisks) {
      map.set(item.crewId, item);
    }
    return map;
  }, [formerAccessRisks]);
  const formerAccessRiskCounts = useMemo(
    () => ({
      linked_login: formerAccessRisks.filter((risk) => risk.hasLinkedLogin).length,
      login_enabled: formerAccessRisks.filter((risk) => risk.loginEnabled).length,
      vessel_access: formerAccessRisks.filter((risk) => risk.vesselAccessCount > 0).length,
      hub_access: formerAccessRisks.filter((risk) => risk.hubAdmin).length,
    }),
    [formerAccessRisks]
  );
  const accessStatusCounts = useMemo(() => {
    const counts: Record<CrewAccessReadinessStatus, number> = {
      ready: 0,
      no_login: 0,
      login_disabled: 0,
      no_password_set: 0,
      temporary_password_issued: 0,
      password_change_required: 0,
      password_required: 0,
      no_vessel_scope: 0,
      no_dashboard: 0,
      fleet_scope_review: 0,
    };
    for (const item of accessReadiness) {
      counts[item.status] += 1;
    }
    return counts;
  }, [accessReadiness]);

  return {
    accessReadinessByCrewId,
    formerAccessRiskByCrewId,
    formerAccessRiskCounts,
    accessStatusCounts,
  };
}

type FilteredCrewOptions = {
  includeStatusFilter?: boolean;
  includeAccessFilter?: boolean;
  includeFormerAccessRiskFilter?: boolean;
};

type CrewRosterFilterInput = {
  crew: CrewListItem[];
  debouncedSearchTerm: string;
  searchTerm: string;
  selectedVessel: string;
  selectedRank: string;
  selectedStatus: string;
  selectedSkill: string;
  selectedAccessStatus: string;
  selectedFormerAccessRisk: FormerCrewAccessRiskFilter;
  accessReadinessEnabled: boolean;
  accessReadinessByCrewId: Map<string, CrewAccessReadiness>;
  formerAccessRiskByCrewId: Map<string, FormerCrewAccessRisk>;
  sortField: SortField;
  sortDirection: SortDirection;
  getVesselName: (vesselId: string) => string;
  roleLookupSortIndex: (rank: string) => number;
};

export function useCrewRosterFilters(input: CrewRosterFilterInput) {
  const filteredAndSortedCrew = useMemo(() => {
    let filtered = filterCrew(input.crew, {
      searchTerm: input.debouncedSearchTerm,
      selectedVessel: input.selectedVessel,
      selectedRank: input.selectedRank,
      selectedStatus: input.selectedStatus,
      selectedSkill: input.selectedSkill,
    });
    if (input.accessReadinessEnabled && input.selectedAccessStatus !== "all") {
      filtered = filtered.filter(
        (member) =>
          input.accessReadinessByCrewId.get(member.id)?.status === input.selectedAccessStatus
      );
    }
    return sortCrew(
      filtered,
      input.sortField,
      input.sortDirection,
      input.getVesselName,
      input.roleLookupSortIndex
    );
  }, [
    input.crew,
    input.debouncedSearchTerm,
    input.selectedVessel,
    input.selectedRank,
    input.selectedStatus,
    input.selectedSkill,
    input.selectedAccessStatus,
    input.accessReadinessEnabled,
    input.accessReadinessByCrewId,
    input.sortField,
    input.sortDirection,
    input.getVesselName,
    input.roleLookupSortIndex,
  ]);

  const getFilteredSortedCrew = (baseCrew: CrewListItem[], options: FilteredCrewOptions = {}) => {
    const includeStatusFilter = options.includeStatusFilter ?? true;
    const includeAccessFilter = options.includeAccessFilter ?? input.accessReadinessEnabled;
    const includeFormerAccessRiskFilter = options.includeFormerAccessRiskFilter ?? false;
    let filtered = filterCrew(baseCrew, {
      searchTerm: input.debouncedSearchTerm,
      selectedVessel: input.selectedVessel,
      selectedRank: input.selectedRank,
      selectedStatus: includeStatusFilter ? input.selectedStatus : "all",
      selectedSkill: input.selectedSkill,
      getVesselName: input.getVesselName,
    });
    if (includeAccessFilter && input.selectedAccessStatus !== "all") {
      filtered = filtered.filter(
        (member) =>
          input.accessReadinessByCrewId.get(member.id)?.status === input.selectedAccessStatus
      );
    }
    if (includeFormerAccessRiskFilter && input.selectedFormerAccessRisk !== "all") {
      filtered = filtered.filter((member) => {
        const risk = input.formerAccessRiskByCrewId.get(member.id);
        if (!risk) {
          return false;
        }
        switch (input.selectedFormerAccessRisk) {
          case "linked_login":
            return risk.hasLinkedLogin;
          case "login_enabled":
            return risk.loginEnabled;
          case "vessel_access":
            return risk.vesselAccessCount > 0;
          case "hub_access":
            return risk.hubAdmin;
          default:
            return true;
        }
      });
    }
    return sortCrew(
      filtered,
      input.sortField,
      input.sortDirection,
      input.getVesselName,
      input.roleLookupSortIndex
    );
  };

  const activeFilterCount = useMemo(
    () =>
      countActiveFilters({
        searchTerm: input.searchTerm,
        selectedVessel: input.selectedVessel,
        selectedRank: input.selectedRank,
        selectedStatus: input.selectedStatus,
        selectedSkill: input.selectedSkill,
        selectedAccessStatus: input.accessReadinessEnabled ? input.selectedAccessStatus : "all",
      }),
    [
      input.searchTerm,
      input.selectedVessel,
      input.selectedRank,
      input.selectedStatus,
      input.selectedSkill,
      input.selectedAccessStatus,
      input.accessReadinessEnabled,
    ]
  );

  return { filteredAndSortedCrew, getFilteredSortedCrew, activeFilterCount };
}

export async function uploadCrewPhoto(
  crewId: string,
  photo: File,
  onFailure: (description: string) => void
) {
  const { createHeaders, resolveUrl, queryClient } = await import("@/lib/queryClient");
  try {
    const formData = new FormData();
    formData.append("photo", photo);
    const res = await fetch(resolveUrl(`/api/crew/${crewId}/photo`), {
      method: "POST",
      headers: createHeaders(false),
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`Photo upload failed (${res.status})`);
    }
    void queryClient.invalidateQueries({ queryKey: ["/api/crew"] });
  } catch (err) {
    onFailure(err instanceof Error ? err.message : "The crew member was created without a photo.");
  }
}
