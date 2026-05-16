import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  OperatorExperienceBrief,
  OperatorExperienceEvent,
  OperatorRole,
  RecordedOperatorExperienceEvent,
  RoleExperienceProfile,
  RoleInformationNeedSummary,
} from "../types";

interface UseOperatorExperienceArgs {
  role: OperatorRole;
  currentPath?: string;
  statedGoal?: string;
  deviceClass?: "mobile" | "tablet" | "desktop" | "unknown";
  connectionState?: "online" | "offline" | "degraded" | "unknown";
}

function buildBriefQuery(args: UseOperatorExperienceArgs): string {
  const params = new URLSearchParams();
  params.set("role", args.role);
  if (args.currentPath) params.set("currentPath", args.currentPath);
  if (args.statedGoal) params.set("statedGoal", args.statedGoal);
  if (args.deviceClass) params.set("deviceClass", args.deviceClass);
  if (args.connectionState) params.set("connectionState", args.connectionState);
  return `/api/operator-experience/brief?${params.toString()}`;
}

export function useOperatorExperienceBrief(args: UseOperatorExperienceArgs) {
  return useQuery<OperatorExperienceBrief>({
    queryKey: ["/api/operator-experience/brief", args],
    queryFn: () => apiRequest<OperatorExperienceBrief>("GET", buildBriefQuery(args)),
    refetchInterval: 60_000,
  });
}

export function useOperatorExperienceRoles() {
  return useQuery<RoleExperienceProfile[]>({
    queryKey: ["/api/operator-experience/roles"],
    queryFn: () => apiRequest<RoleExperienceProfile[]>("GET", "/api/operator-experience/roles"),
    staleTime: 5 * 60_000,
  });
}

export function useRecordOperatorExperienceEvent() {
  return useMutation({
    mutationFn: (payload: OperatorExperienceEvent) =>
      apiRequest<RecordedOperatorExperienceEvent>("POST", "/api/operator-experience/events", payload),
  });
}

export function useRoleInformationNeeds(role: OperatorRole) {
  return useQuery<RoleInformationNeedSummary>({
    queryKey: ["/api/operator-experience/information-needs", role],
    queryFn: () =>
      apiRequest<RoleInformationNeedSummary>(
        "GET",
        `/api/operator-experience/information-needs?role=${encodeURIComponent(role)}`
      ),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
