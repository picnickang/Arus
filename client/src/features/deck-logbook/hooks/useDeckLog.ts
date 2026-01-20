import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { DeckLogComplete, DeckLogDaily, DeckLogHourly, DeckLogWatch, DeckLogEvent } from "../types";

export const deckLogKeys = {
  all: ["/api/logbook/deck"] as const,
  daily: (vesselId: string, date: string) => [...deckLogKeys.all, "daily", vesselId, date] as const,
  complete: (vesselId: string, date: string) => [...deckLogKeys.all, "complete", vesselId, date] as const,
  events: (vesselId: string, dayId: string) => [...deckLogKeys.all, "events", vesselId, dayId] as const,
  officers: () => ["/api/crew/officers"] as const,
};

export function useDeckLogComplete(vesselId: string | undefined, date: string) {
  return useQuery<DeckLogComplete>({
    queryKey: deckLogKeys.complete(vesselId || "", date),
    queryFn: () => apiRequest("GET", `/api/logbook/deck/complete?vesselId=${vesselId}&date=${date}`),
    enabled: !!vesselId && !!date,
    staleTime: 30000,
  });
}

export function useDeckLogDaily(vesselId: string | undefined, date: string) {
  return useQuery<DeckLogDaily>({
    queryKey: deckLogKeys.daily(vesselId || "", date),
    queryFn: () => apiRequest("GET", `/api/logbook/deck/daily?vesselId=${vesselId}&date=${date}`),
    enabled: !!vesselId && !!date,
  });
}

export function useDeckOfficers() {
  return useQuery<Array<{ id: string; name: string; rank: string }>>({
    queryKey: deckLogKeys.officers(),
  });
}

export function useSaveDeckLog() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      daily: Partial<DeckLogDaily>;
      hourlyEntries: DeckLogHourly[];
      watches: DeckLogWatch[];
    }) => {
      await apiRequest("PATCH", `/api/logbook/deck/daily/${data.daily.id}`, data.daily);
      if (data.hourlyEntries.length > 0) {
        await apiRequest("PUT", "/api/logbook/deck/hourly/bulk", { entries: data.hourlyEntries });
      }

      if (data.watches.length > 0) {
        await apiRequest("PUT", "/api/logbook/deck/watch", { watches: data.watches });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deckLogKeys.all });
    },
  });
}

export function useSignDeckLog() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ dailyId, crewId, name, rank }: { dailyId: string; crewId: string; name: string; rank: string }) => {
      return apiRequest("POST", `/api/logbook/deck/daily/${dailyId}/sign`, { crewId, name, rank });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deckLogKeys.all });
    },
  });
}

export function useLockDeckLog() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ dailyId }: { dailyId: string }) => {
      return apiRequest("POST", `/api/logbook/deck/daily/${dailyId}/lock`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deckLogKeys.all });
    },
  });
}

export function useCreateDeckEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (event: Omit<DeckLogEvent, "id">) => {
      return apiRequest("POST", "/api/logbook/deck/events", event);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deckLogKeys.all });
    },
  });
}

export function useStormGeoAutofill() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ vesselId, date }: { vesselId: string; date: string }) => {
      return apiRequest("POST", "/api/stormgeo/autofill-daily", { vesselId, date });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deckLogKeys.all });
    },
  });
}
