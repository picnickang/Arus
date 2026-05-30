/**
 * User Portal Dashboard — view model (composition).
 *
 * UI Align Phase 4 owns the user-portal home re-skin per preview
 * panel 2 / mobile panel 9. The page must:
 *   - render the cards in the mockup (current vessel, my shift,
 *     active alerts, safety notices, upcoming maintenance),
 *   - bind only to existing user-scoped reads (no new endpoints), and
 *   - preserve the stable empty-state ids (`empty-attention`,
 *     `empty-my-tasks`, `empty-feedback-history`) that other surfaces
 *     already key off.
 *
 * Hexagonal boundary: this module is the only place that talks to
 * TanStack Query for the user-portal home. The React page consumes
 * `useUserDashboardViewModel()` and renders the returned slots; it
 * does NOT call `useQuery` directly. That keeps the page free of
 * data-source decisions and means any future change to a hook URL,
 * polling cadence, or response shape lands here in one place.
 *
 * Pure helpers (`deriveAlertSlots`, `deriveShiftStatus`) and shared
 * slot types live in sibling leaf modules (`./derivers`, `./types`)
 * so they can be unit-tested without React or `@/`-alias resolution.
 *
 * Where each slot comes from (all PRE-EXISTING reads — out of scope
 * to add new backend endpoints per task #188):
 *   - currentVessel      → GET /api/vessels (first vessel the
 *                          authenticated user can see; the user-portal
 *                          mockup shows the vessel they are aboard,
 *                          which is the first row the backend returns
 *                          after server-side tenant + vessel-access
 *                          filtering).
 *   - activeAlerts       → GET /api/alerts (filtered to unacknowledged
 *                          client-side because the existing list
 *                          endpoint returns the same shape used
 *                          elsewhere; no new query param introduced).
 *   - upcomingMaintenance→ GET /api/maintenance-schedules/upcoming
 *                          (via the shared useUpcomingMaintenance hook).
 *   - safetyNotices      → derived from the active-alerts feed,
 *                          filtering for the existing `safety`
 *                          category. There is no separate "safety
 *                          notice" endpoint yet (out of scope), so we
 *                          surface the safety-categorised alerts as a
 *                          calmer card with the same empty-state
 *                          contract as the others.
 *   - shiftStatus        → resolved from the real shift-template
 *                          registry (GET /api/shifts) for the user's
 *                          current vessel; the on-duty flag, window,
 *                          remaining time and progress are computed
 *                          against that configured window. When the
 *                          backend has no shift template at all we fall
 *                          back to a clock-derived default 12-hour
 *                          window (slot `source: "fallback"`). This
 *                          card is a visual cue only; it is never used
 *                          for compliance reporting.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUpcomingMaintenance } from "@/features/maintenance/hooks/useMaintenance";
import {
  deriveAlertSlots,
  deriveMyTasks,
  deriveSafetyStatus,
  deriveShiftStatus,
  type RawShiftTemplate,
} from "./derivers";
import type {
  ActiveAlertSlot,
  CurrentVesselSlot,
  MyTaskSlot,
  SafetyNoticeSlot,
  SafetyStatusSlot,
  ShiftStatusSlot,
  UpcomingMaintenanceSlot,
} from "./types";

export {
  deriveAlertSlots,
  deriveMyTasks,
  deriveSafetyStatus,
  deriveShiftStatus,
} from "./derivers";
export type {
  ActiveAlertSlot,
  AlertSeverity,
  CurrentVesselSlot,
  MyTaskSlot,
  SafetyNoticeSlot,
  SafetyStatusLevel,
  SafetyStatusSlot,
  ShiftStatusSlot,
  TaskDayPill,
  UpcomingMaintenanceSlot,
} from "./types";

export interface UserDashboardViewModel {
  isLoading: boolean;
  currentVessel: CurrentVesselSlot | undefined;
  activeAlerts: ActiveAlertSlot[];
  safetyNotices: SafetyNoticeSlot[];
  safetyStatus: SafetyStatusSlot;
  myTasks: MyTaskSlot[];
  upcomingMaintenance: UpcomingMaintenanceSlot[];
  shiftStatus: ShiftStatusSlot;
}

interface RawVessel {
  id: string;
  name: string;
  imo?: string | null;
}

interface RawWorkOrderRow {
  id: string;
  title?: string | null;
  priority?: number | null;
  dueDate?: string | null;
  equipmentName?: string | null;
  vesselName?: string | null;
  equipment?: { name?: string | null } | null;
}

interface RawAlertRow {
  id: string;
  title?: string | null;
  message?: string | null;
  severity?: string | null;
  acknowledged?: boolean | null;
  category?: string | null;
  source?: string | null;
  equipmentName?: string | null;
  createdAt?: string | null;
}

export function useUserDashboardViewModel(): UserDashboardViewModel {
  const { data: vessels, isLoading: vesselsLoading } = useQuery<RawVessel[]>({
    queryKey: ["/api/vessels"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery<RawAlertRow[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 60000,
  });

  // My open work orders — the user-portal "My Tasks" card. Same read
  // the legacy admin MyTasks used; centralised here so the page stays
  // free of direct useQuery calls (task #220 constraint).
  const { data: workOrders, isLoading: tasksLoading } = useQuery<RawWorkOrderRow[]>({
    queryKey: ["/api/work-orders", { assignedToMe: "true", status: "open" }],
    refetchInterval: 60000,
  });

  const { data: maintenance, isLoading: maintLoading } = useUpcomingMaintenance(7);

  // Real configured shift windows (crew shift-template registry). The
  // shift card falls back to a clock-derived default only when this
  // returns nothing, so we do NOT gate the dashboard skeleton on it.
  const { data: shiftTemplates } = useQuery<RawShiftTemplate[]>({
    queryKey: ["/api/shifts"],
    staleTime: 5 * 60 * 1000,
  });

  const currentVessel = useMemo<CurrentVesselSlot | undefined>(() => {
    if (!Array.isArray(vessels) || vessels.length === 0) return undefined;
    const first = vessels[0];
    return { id: first.id, name: first.name, imo: first.imo ?? undefined };
  }, [vessels]);

  const alertRows = useMemo(
    () => (Array.isArray(alerts) ? alerts : []),
    [alerts],
  );

  const { activeAlerts, safetyNotices } = useMemo(
    () => deriveAlertSlots(alertRows),
    [alertRows],
  );

  const safetyStatus = useMemo(
    () => deriveSafetyStatus(alertRows),
    [alertRows],
  );

  const upcomingMaintenance = useMemo<UpcomingMaintenanceSlot[]>(() => {
    if (!Array.isArray(maintenance)) return [];
    return maintenance.slice(0, 4).map((m) => ({
      id: m.id,
      title: m.title,
      scheduledDate:
        m.scheduledDate instanceof Date ? m.scheduledDate : new Date(m.scheduledDate),
      priority: m.priority,
    }));
  }, [maintenance]);

  // Tick once a minute so `On duty / Off duty` and the remaining-minutes
  // readout stay accurate across long sessions. Architect flagged the
  // prior `useMemo(..., [])` form as stale-on-mount.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const handle = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(handle);
  }, []);
  const shiftStatus = useMemo(
    () =>
      deriveShiftStatus(
        now,
        Array.isArray(shiftTemplates) ? shiftTemplates : [],
        currentVessel?.id,
      ),
    [now, shiftTemplates, currentVessel?.id],
  );

  const myTasks = useMemo<MyTaskSlot[]>(
    () => deriveMyTasks(Array.isArray(workOrders) ? workOrders : [], now),
    [workOrders, now],
  );

  return {
    isLoading: vesselsLoading || alertsLoading || tasksLoading || maintLoading,
    currentVessel,
    activeAlerts,
    safetyNotices,
    safetyStatus,
    myTasks,
    upcomingMaintenance,
    shiftStatus,
  };
}
