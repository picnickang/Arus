/**
 * Data layer for the Crew Task Tracker.
 *
 * All mutations go through the shared `apiRequest` so they queue in the
 * offline outbox and replay on reconnect. Every mutation invalidates the
 * `/api/crew-tasks` list and the personal `/api/me/tasks` feed so the board,
 * the landing tile, and a crew member's Assigned Tasks stay in sync.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { CrewTaskStatus, CrewTaskPriority, CrewTaskLinkedSourceType } from "@shared/schema";
import type { CrewTaskView } from "../lib/crewTaskUtils";

const TASKS_KEY = "/api/crew-tasks";
const ME_TASKS_KEY = "/api/me/tasks";

export interface CreateCrewTaskInput {
  title: string;
  description?: string;
  vesselId?: string;
  assignedCrewId?: string;
  status?: CrewTaskStatus;
  priority?: CrewTaskPriority;
  dueDate?: string;
  blockedReason?: string;
  assignedTo?: string;
  linkedSourceType?: CrewTaskLinkedSourceType | undefined;
  linkedSourceId?: string;
  linkedSourceLabel?: string | undefined;
}

function invalidateTaskQueries(client: ReturnType<typeof useQueryClient>) {
  client.invalidateQueries({ queryKey: [TASKS_KEY] });
  client.invalidateQueries({ queryKey: [ME_TASKS_KEY] });
}

export function useCreateCrewTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCrewTaskInput) => apiRequest<CrewTaskView>("POST", TASKS_KEY, input),
    onSuccess: () => invalidateTaskQueries(client),
  });
}
