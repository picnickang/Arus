/**
 * useHoRSync Hook
 *
 * Provides real-time Hours of Rest projection and STCW compliance feedback
 * during scheduling operations like drag-to-reschedule.
 */

import { useState, useCallback, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export type FatigueRiskLevel = "low" | "medium" | "high" | "critical";

export interface ProjectionViolation {
  crewId: string;
  crewName?: string;
  date: string;
  rule: "10h_24h" | "77h_7d" | "split_rest" | "overlap" | "max_consecutive";
  severity: "warning" | "error";
  description: string;
  currentValue?: number;
  threshold?: number;
}

export interface CanAssignResult {
  canAssign: boolean;
  violations: ProjectionViolation[];
  projectedRestHours: number;
  projectedWeeklyWork: number;
  fatigueRisk?: FatigueRiskLevel;
}

export interface DraftAssignment {
  id?: string;
  crewId: string;
  crewName?: string;
  vesselId?: string;
  start: string;
  end: string;
  shiftName?: string;
  position?: string;
}

export interface ProjectionSummary {
  totalCrew: number;
  compliantCrew: number;
  warningCount: number;
  errorCount: number;
}

export interface ProjectionResult {
  isCompliant: boolean;
  violations: ProjectionViolation[];
  summary: ProjectionSummary;
}

interface UseHoRSyncOptions {
  debounceMs?: number;
}

export function useHoRSync(options: UseHoRSyncOptions = {}) {
  const { debounceMs = 150 } = options;
  const { toast } = useToast();

  const [isProjecting, setIsProjecting] = useState(false);
  const [lastProjection, setLastProjection] = useState<CanAssignResult | null>(null);
  const [projectionError, setProjectionError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const cancelPendingRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const canAssignCrew = useCallback(
    async (
      crewId: string,
      proposedAssignment: DraftAssignment,
      existingDrafts?: DraftAssignment[]
    ): Promise<CanAssignResult> => {
      setIsProjecting(true);
      setProjectionError(null);
      cancelPendingRequest();

      abortControllerRef.current = new AbortController();

      try {
        const response = await apiRequest(
          "POST",
          "/api/crew-extensions/scheduler/can-assign",
          {
            crewId,
            proposedAssignment,
            existingDrafts,
          },
          { signal: abortControllerRef.current.signal }
        );

        const result = response as CanAssignResult;
        setLastProjection(result);
        return result;
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          return (
            lastProjection || {
              canAssign: true,
              violations: [],
              projectedRestHours: 24,
              projectedWeeklyWork: 0,
            }
          );
        }

        const message =
          (error instanceof Error && error.message) || "Failed to check assignment compliance";
        setProjectionError(message);

        return {
          canAssign: true,
          violations: [],
          projectedRestHours: 24,
          projectedWeeklyWork: 0,
        };
      } finally {
        setIsProjecting(false);
      }
    },
    [cancelPendingRequest, lastProjection]
  );

  const canAssignCrewDebounced = useCallback(
    (
      crewId: string,
      proposedAssignment: DraftAssignment,
      existingDrafts?: DraftAssignment[],
      onResult?: (result: CanAssignResult) => void
    ) => {
      clearDebounce();
      setIsProjecting(true);

      debounceRef.current = setTimeout(async () => {
        const result = await canAssignCrew(crewId, proposedAssignment, existingDrafts);
        onResult?.(result);
      }, debounceMs);
    },
    [canAssignCrew, clearDebounce, debounceMs]
  );

  const projectBulkAssignments = useCallback(
    async (assignments: DraftAssignment[]): Promise<ProjectionResult> => {
      setIsProjecting(true);
      setProjectionError(null);

      try {
        const response = await apiRequest(
          "POST",
          "/api/crew-extensions/scheduler/project-compliance",
          { assignments }
        );

        return response as ProjectionResult;
      } catch (error: unknown) {
        const message =
          (error instanceof Error && error.message) || "Failed to project compliance";
        setProjectionError(message);

        return {
          isCompliant: true,
          violations: [],
          summary: {
            totalCrew: 0,
            compliantCrew: 0,
            warningCount: 0,
            errorCount: 0,
          },
        };
      } finally {
        setIsProjecting(false);
      }
    },
    []
  );

  const resetProjection = useCallback(() => {
    clearDebounce();
    cancelPendingRequest();
    setLastProjection(null);
    setProjectionError(null);
    setIsProjecting(false);
  }, [clearDebounce, cancelPendingRequest]);

  const getComplianceColor = useCallback((result: CanAssignResult | null): string => {
    if (!result) {
      return "border-transparent";
    }

    const hasErrors = result.violations.some((v) => v.severity === "error");
    const hasWarnings = result.violations.some((v) => v.severity === "warning");

    if (hasErrors) {
      return "border-red-500";
    }
    if (hasWarnings) {
      return "border-amber-500";
    }
    return "border-green-500";
  }, []);

  const getFatigueColor = useCallback((risk: FatigueRiskLevel | undefined): string => {
    switch (risk) {
      case "critical":
        return "text-red-600 dark:text-red-400";
      case "high":
        return "text-orange-600 dark:text-orange-400";
      case "medium":
        return "text-amber-600 dark:text-amber-400";
      case "low":
        return "text-green-600 dark:text-green-400";
      default:
        return "text-muted-foreground";
    }
  }, []);

  return {
    isProjecting,
    lastProjection,
    projectionError,
    canAssignCrew,
    canAssignCrewDebounced,
    projectBulkAssignments,
    resetProjection,
    getComplianceColor,
    getFatigueColor,
  };
}
