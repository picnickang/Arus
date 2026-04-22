import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  EngineLogComplete,
  EngineLogDaily,
  EngineLogHourly,
  EngineLogGenerator,
  EngineLogWatch,
  EngineLogEvent,
} from "../types";

export const engineLogKeys = {
  all: ["/api/logbook/engine"] as const,
  daily: (vesselId: string, date: string) =>
    [...engineLogKeys.all, "daily", vesselId, date] as const,
  complete: (vesselId: string, date: string) =>
    [...engineLogKeys.all, "complete", vesselId, date] as const,
  events: (vesselId: string, dayId: string) =>
    [...engineLogKeys.all, "events", vesselId, dayId] as const,
  crew: () => ["/api/crew/engineers"] as const,
};

export function useEngineLogComplete(vesselId: string | undefined, date: string) {
  return useQuery<EngineLogComplete>({
    queryKey: engineLogKeys.complete(vesselId || "", date),
    queryFn: () =>
      apiRequest("GET", `/api/logbook/engine/complete?vesselId=${vesselId}&date=${date}`),
    enabled: !!vesselId && !!date,
    staleTime: 30000,
  });
}

export function useEngineLogDaily(vesselId: string | undefined, date: string) {
  return useQuery<EngineLogDaily>({
    queryKey: engineLogKeys.daily(vesselId || "", date),
    queryFn: () => apiRequest("GET", `/api/logbook/engine/daily?vesselId=${vesselId}&date=${date}`),
    enabled: !!vesselId && !!date,
  });
}

export function useEngineCrew() {
  return useQuery<Array<{ id: string; name: string; rank: string }>>({
    queryKey: engineLogKeys.crew(),
  });
}

export function useSaveEngineLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      daily: Partial<EngineLogDaily>;
      hourlyEntries: EngineLogHourly[];
      generatorEntries: EngineLogGenerator[];
      watches: EngineLogWatch[];
    }) => {
      await apiRequest("PATCH", `/api/logbook/engine/daily/${data.daily.id}`, data.daily);
      if (data.hourlyEntries.length > 0) {
        await apiRequest("PUT", "/api/logbook/engine/hourly/bulk", { entries: data.hourlyEntries });
      }

      if (data.generatorEntries.length > 0) {
        await apiRequest("PUT", "/api/logbook/engine/generator/bulk", {
          entries: data.generatorEntries,
        });
      }

      if (data.watches.length > 0) {
        await apiRequest("PUT", "/api/logbook/engine/watch", { watches: data.watches });
      }
    },
    onSuccess: (_result, _variables) => {
      queryClient.invalidateQueries({ queryKey: engineLogKeys.all });
    },
  });
}

export function useSignEngineLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dailyId,
      crewId,
      name,
      rank,
    }: {
      dailyId: string;
      crewId: string;
      name: string;
      rank: string;
    }) => {
      return apiRequest("POST", `/api/logbook/engine/daily/${dailyId}/sign`, {
        crewId,
        name,
        rank,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: engineLogKeys.all });
    },
  });
}

export function useLockEngineLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dailyId }: { dailyId: string }) => {
      return apiRequest("POST", `/api/logbook/engine/daily/${dailyId}/lock`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: engineLogKeys.all });
    },
  });
}

export function useCreateEngineEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (event: Omit<EngineLogEvent, "id">) => {
      return apiRequest("POST", "/api/logbook/engine/events", event);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: engineLogKeys.all });
    },
  });
}

export function useEngineLogAutofill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vesselId, date }: { vesselId: string; date: string }) => {
      return apiRequest("POST", "/api/logbook/engine/autofill", { vesselId, date });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: engineLogKeys.all });
    },
  });
}
