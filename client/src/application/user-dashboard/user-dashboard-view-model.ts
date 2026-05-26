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
 *   - shiftStatus        → derived purely from the current clock and
 *                          a default 12-hour rotation. The pilot
 *                          backend has no per-user "current shift
 *                          remaining" endpoint and the task explicitly
 *                          forbids adding one. We render this as a
 *                          visual cue only; it is never used for
 *                          compliance reporting.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUpcomingMaintenance } from "@/features/maintenance/hooks/useMaintenance";
import { deriveAlertSlots, deriveShiftStatus } from "./derivers";
import type {
  ActiveAlertSlot,
  CurrentVesselSlot,
  SafetyNoticeSlot,
  ShiftStatusSlot,
  UpcomingMaintenanceSlot,
} from "./types";

export { deriveAlertSlots, deriveShiftStatus } from "./derivers";
export type {
  ActiveAlertSlot,
  AlertSeverity,
  CurrentVesselSlot,
  SafetyNoticeSlot,
  ShiftStatusSlot,
  UpcomingMaintenanceSlot,
} from "./types";

export interface UserDashboardViewModel {
  isLoading: boolean;
  currentVessel: CurrentVesselSlot | undefined;
  activeAlerts: ActiveAlertSlot[];
  safetyNotices: SafetyNoticeSlot[];
  upcomingMaintenance: UpcomingMaintenanceSlot[];
  shiftStatus: ShiftStatusSlot;
}

interface RawVessel {
  id: string;
  name: string;
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

  const { data: maintenance, isLoading: maintLoading } = useUpcomingMaintenance(7);

  const currentVessel = useMemo<CurrentVesselSlot | undefined>(() => {
    if (!Array.isArray(vessels) || vessels.length === 0) return undefined;
    const first = vessels[0];
    return { id: first.id, name: first.name };
  }, [vessels]);

  const { activeAlerts, safetyNotices } = useMemo(
    () => deriveAlertSlots(Array.isArray(alerts) ? alerts : []),
    [alerts],
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
  const shiftStatus = useMemo(() => deriveShiftStatus(now), [now]);

  return {
    isLoading: vesselsLoading || alertsLoading || maintLoading,
    currentVessel,
    activeAlerts,
    safetyNotices,
    upcomingMaintenance,
    shiftStatus,
  };
}
