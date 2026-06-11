/**
 * Data layer for the Crew Task Tracker.
 *
 * All mutations go through the shared `apiRequest` so they queue in the
 * offline outbox and replay on reconnect. Every mutation invalidates the
 * `/api/crew-tasks` list and the personal `/api/me/tasks` feed so the board,
 * the landing tile, and a crew member's Assigned Tasks stay in sync.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CrewTaskStatus, CrewTaskPriority, CrewTaskLinkedSourceType } from "@shared/schema";
import type { CrewTaskView, CrewTaskEventView } from "../lib/crewTaskUtils";

const TASKS_KEY = "/api/crew-tasks";
const ME_TASKS_KEY = "/api/me/tasks";

export interface CrewTaskListFilters {
  vesselId?: string;
  assignedCrewId?: string;
  status?: CrewTaskStatus;
  includeDone?: boolean;
}

function buildListKey(filters?: CrewTaskListFilters) {
  return [TASKS_KEY, filters ?? {}] as const;
}

function buildQueryString(filters?: CrewTaskListFilters): string {
  if (!filters) {
    return "";
  }
  const params = new URLSearchParams();
  if (filters.vesselId) {
    params.set("vesselId", filters.vesselId);
  }
  if (filters.assignedCrewId) {
    params.set("assignedCrewId", filters.assignedCrewId);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.includeDone) {
    params.set("includeDone", "true");
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useCrewTasks(filters?: CrewTaskListFilters) {
  return useQuery<CrewTaskView[]>({
    queryKey: buildListKey(filters),
    queryFn: () => apiRequest<CrewTaskView[]>(`${TASKS_KEY}${buildQueryString(filters)}`),
  });
}

export function useCrewTask(id: string | null) {
  return useQuery<CrewTaskView>({
    queryKey: [TASKS_KEY, id],
    queryFn: () => apiRequest<CrewTaskView>(`${TASKS_KEY}/${id}`),
    enabled: Boolean(id),
  });
}

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

export interface UpdateCrewTaskInput {
  title?: string;
  description?: string | null;
  vesselId?: string | null;
  assignedCrewId?: string | null;
  status?: CrewTaskStatus;
  priority?: CrewTaskPriority;
  dueDate?: string | null;
  blockedReason?: string | null;
  assignedTo?: string | null;
  linkedSourceType?: CrewTaskLinkedSourceType | null;
  linkedSourceId?: string | null;
  linkedSourceLabel?: string | null;
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

export function useUpdateCrewTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateCrewTaskInput }) =>
      apiRequest<CrewTaskView>("PATCH", `${TASKS_KEY}/${id}`, patch),
    onSuccess: () => invalidateTaskQueries(client),
  });
}

export function useDeleteCrewTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<null>("DELETE", `${TASKS_KEY}/${id}`),
    onSuccess: () => invalidateTaskQueries(client),
  });
}

/** Activity log (system events + comments) for a single task. */
export function useCrewTaskEvents(id: string | null) {
  return useQuery<CrewTaskEventView[]>({
    queryKey: [TASKS_KEY, id, "events"],
    queryFn: () => apiRequest<CrewTaskEventView[]>(`${TASKS_KEY}/${id}/events`),
    enabled: Boolean(id),
  });
}

export function useAddCrewTaskComment(id: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (message: string) =>
      apiRequest<CrewTaskEventView>("POST", `${TASKS_KEY}/${id}/comments`, { message }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [TASKS_KEY, id, "events"] });
    },
  });
}

/** Imperative invalidation for WebSocket-driven live refresh. */
export function invalidateCrewTasks() {
  invalidateTaskQueries(queryClient);
}

/** Invalidate one task's activity log (WebSocket-driven live refresh). */
export function invalidateCrewTaskEvents(id: string) {
  queryClient.invalidateQueries({ queryKey: [TASKS_KEY, id, "events"] });
}
