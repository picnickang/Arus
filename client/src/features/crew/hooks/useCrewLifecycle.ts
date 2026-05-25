import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { crewKeys } from "./useCrew";

export interface EmploymentHistoryRecord {
  id: string;
  orgId: string;
  crewId: string;
  startDate: string;
  endDate: string | null;
  terminationType: "retired" | "cancelled" | null;
  terminationNotes: string | null;
  contractPenalty: number | null;
  vesselId: string | null;
  rank: string | null;
  createdAt: string;
}

export interface CrewMemberBasic {
  id: string;
  orgId: string;
  name: string;
  email: string | null;
  rank: string;
  vesselId: string | null;
  active: boolean;
  onDuty: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FormerCrewMember extends CrewMemberBasic {
  employmentPeriods: EmploymentHistoryRecord[];
}

export const lifecycleKeys = {
  former: () => ["/api/crew/former"] as const,
  history: (crewId: string) => ["/api/crew", crewId, "history"] as const,
};

export function useFormerCrew() {
  return useQuery<FormerCrewMember[]>({
    queryKey: lifecycleKeys.former(),
    queryFn: () => apiRequest<FormerCrewMember[]>("GET", "/api/crew/former"),
  });
}

export function useEmploymentHistory(crewId: string | undefined) {
  return useQuery<EmploymentHistoryRecord[]>({
    queryKey: lifecycleKeys.history(crewId || ""),
    queryFn: () => apiRequest<EmploymentHistoryRecord[]>("GET", `/api/crew/${crewId}/history`),
    enabled: !!crewId,
  });
}

export function useRetireCrew() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ crewId, notes }: { crewId: string; notes?: string | undefined }) => {
      return apiRequest("POST", `/api/crew/${crewId}/retire`, { notes });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: crewKeys.all });
      queryClient.refetchQueries({ queryKey: crewKeys.all });
      queryClient.invalidateQueries({ queryKey: lifecycleKeys.former() });
      queryClient.invalidateQueries({ queryKey: lifecycleKeys.history(variables.crewId) });
      toast({ title: "Crew member retired", description: "Employment record has been updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to retire crew member",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCancelContract() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      crewId,
      notes,
      applyPenalty,
    }: {
      crewId: string;
      notes?: string | undefined;
      applyPenalty?: boolean | undefined;
    }) => {
      return apiRequest("POST", `/api/crew/${crewId}/cancel`, { notes, applyPenalty });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: crewKeys.all });
      queryClient.refetchQueries({ queryKey: crewKeys.all });
      queryClient.invalidateQueries({ queryKey: lifecycleKeys.former() });
      queryClient.invalidateQueries({ queryKey: lifecycleKeys.history(variables.crewId) });
      toast({ title: "Contract cancelled", description: "Employment record has been updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to cancel contract",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useReinstateCrew() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      crewId,
      notes,
      startDate,
    }: {
      crewId: string;
      notes?: string | undefined;
      startDate?: string | undefined;
    }) => {
      return apiRequest("POST", `/api/crew/${crewId}/reinstate`, { notes, startDate });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: crewKeys.all });
      queryClient.refetchQueries({ queryKey: crewKeys.all });
      queryClient.invalidateQueries({ queryKey: lifecycleKeys.former() });
      queryClient.invalidateQueries({ queryKey: lifecycleKeys.history(variables.crewId) });
      toast({
        title: "Crew member reinstated",
        description: "They are now back on the active roster",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reinstate crew member",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteFormerCrew() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (crewId: string) => {
      return apiRequest("DELETE", `/api/crew/${crewId}/former`);
    },
    onSuccess: (_data, crewId) => {
      queryClient.invalidateQueries({ queryKey: lifecycleKeys.former() });
      queryClient.invalidateQueries({ queryKey: lifecycleKeys.history(crewId) });
      queryClient.removeQueries({ queryKey: lifecycleKeys.history(crewId) });
      toast({
        title: "Former crew record deleted",
        description: "The record has been permanently removed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete record",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export interface UpdateEmploymentHistoryInput {
  startDate?: string;
  endDate?: string;
  terminationType?: "retired" | "cancelled";
  terminationNotes?: string;
  contractPenalty?: number | null;
  vesselId?: string | null;
  rank?: string | null;
}

export function useUpdateEmploymentHistory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      historyId,
      data,
    }: {
      historyId: string;
      data: UpdateEmploymentHistoryInput;
    }) => {
      return apiRequest("PUT", `/api/crew/history/${historyId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lifecycleKeys.former() });
      toast({ title: "Employment period updated", description: "The changes have been saved" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update employment period",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteEmploymentHistory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (historyId: string) => {
      return apiRequest("DELETE", `/api/crew/history/${historyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lifecycleKeys.former() });
      toast({ title: "Employment period deleted", description: "The record has been removed" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete employment period",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
