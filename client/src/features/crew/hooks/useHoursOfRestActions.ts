import { useCallback } from "react";
import type * as React from "react";
import type { QueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { toast as toastFn } from "@/hooks/use-toast";
import {
  type DayRow,
  type ShiftPattern,
  MONTHS,
  emptyMonth,
  toCSV,
  parseCSV,
  timeToHourPattern,
  applyPatternToRows,
  getWeekdayIndices,
  getWeekendIndices,
  copyWeekData,
  applyRestPeriodToAllDays,
  clearAllHours,
} from "@/features/crew";
import type { ComplianceResult, HoursOfRestMeta } from "./useHoursOfRestDataTypes";

type ToastFn = typeof toastFn;
type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export interface UseHoursOfRestActionsParams {
  rows: DayRow[];
  setRows: SetState<DayRow[]>;
  csv: string;
  setCsv: SetState<string>;
  setMode: SetState<"GRID" | "CSV">;
  customPatterns: ShiftPattern[];
  customRestStart: string;
  customRestEnd: string;
  meta: HoursOfRestMeta;
  monthsToCopy: string[];
  setMonthsToCopy: SetState<string[]>;
  monthsToRemove: string[];
  setMonthsToRemove: SetState<string[]>;
  isReadyForActions: boolean;
  isVesselSelected: boolean;
  isCrewSelected: boolean;
  addToHistory: (newRows: DayRow[]) => void;
  setSaveStatus: SetState<"saved" | "saving" | "unsaved">;
  setResult: SetState<ComplianceResult | null>;
  queryClient: QueryClient;
  toast: ToastFn;
}

export interface UseHoursOfRestActionsReturn {
  exportCSV: () => void;
  importCSV: () => void;
  clearAll: () => void;
  applyPattern: (patternId: string, dayIndices: number[]) => void;
  applyToWeekdays: (patternId: string) => void;
  applyToWeekends: (patternId: string) => void;
  copyWeek: (sourceWeek: number, targetWeeks: number[]) => void;
  applyCustomRestToAllDays: () => void;
  copyMonthToYear: () => Promise<void>;
  removeMonths: () => Promise<void>;
  upload: () => Promise<void>;
  runCheck: () => Promise<void>;
  exportPdf: () => Promise<void>;
  loadFromProposedPlan: () => void;
}

export function useHoursOfRestActions({
  rows,
  setRows,
  csv,
  setCsv,
  setMode,
  customPatterns,
  customRestStart,
  customRestEnd,
  meta,
  monthsToCopy,
  setMonthsToCopy,
  monthsToRemove,
  setMonthsToRemove,
  isReadyForActions,
  isVesselSelected,
  isCrewSelected,
  addToHistory,
  setSaveStatus,
  setResult,
  queryClient,
  toast,
}: UseHoursOfRestActionsParams): UseHoursOfRestActionsReturn {
  const exportCSV = useCallback(() => {
    setCsv(toCSV(rows));
    setMode("CSV");
  }, [rows, setCsv, setMode]);

  const importCSV = useCallback(() => {
    if (!csv.trim()) {
      return;
    }
    const parsed = parseCSV(csv);
    if (parsed.length) {
      setRows(parsed);
      addToHistory(parsed);
    }
    setMode("GRID");
  }, [csv, setRows, addToHistory, setMode]);

  const clearAll = useCallback(() => {
    const cleared = clearAllHours(rows);
    setRows(cleared);
    addToHistory(cleared);
  }, [rows, setRows, addToHistory]);

  const applyPattern = useCallback(
    (patternId: string, dayIndices: number[]) => {
      const { rows: next, appliedPattern } = applyPatternToRows(
        rows,
        patternId,
        dayIndices,
        customPatterns
      );
      if (!appliedPattern) {
        return;
      }
      setRows(next);
      addToHistory(next);
      toast({
        title: "Pattern applied",
        description: `Applied ${appliedPattern.name} to ${dayIndices.length} days`,
      });
    },
    [rows, customPatterns, setRows, addToHistory, toast]
  );

  const applyToWeekdays = useCallback(
    (patternId: string) => applyPattern(patternId, getWeekdayIndices(rows)),
    [applyPattern, rows]
  );

  const applyToWeekends = useCallback(
    (patternId: string) => applyPattern(patternId, getWeekendIndices(rows)),
    [applyPattern, rows]
  );

  const copyWeek = useCallback(
    (sourceWeek: number, targetWeeks: number[]) => {
      const next = copyWeekData(rows, sourceWeek, targetWeeks);
      setRows(next);
      addToHistory(next);
      toast({
        title: "Week copied",
        description: `Copied week ${sourceWeek + 1} to ${targetWeeks.length} other week(s)`,
      });
    },
    [rows, setRows, addToHistory, toast]
  );

  const applyCustomRestToAllDays = useCallback(() => {
    const pattern = timeToHourPattern(customRestStart, customRestEnd);
    const next = applyRestPeriodToAllDays(rows, pattern);
    setRows(next);
    addToHistory(next);
    toast({
      title: "Rest period applied",
      description: `Applied ${customRestStart} to ${customRestEnd} rest period to all days of ${meta.month}`,
    });
  }, [rows, customRestStart, customRestEnd, meta.month, setRows, addToHistory, toast]);

  const copyMonthToYear = useCallback(async () => {
    if (monthsToCopy.length === 0) {
      toast({
        title: "No months selected",
        description: "Please select at least one month to copy to",
        variant: "destructive",
      });
      return;
    }
    if (!isReadyForActions) {
      toast({
        title: "Selection required",
        description: "Please select vessel and crew first",
        variant: "destructive",
      });
      return;
    }
    try {
      let successCount = 0;
      for (const targetMonth of monthsToCopy) {
        if (targetMonth === meta.month) {
          continue;
        }
        const targetMonthRows = emptyMonth(meta.year, targetMonth);
        const copiedRows = targetMonthRows.map((targetRow, idx) => {
          if (idx < rows.length) {
            const sourceRow = rows[idx];
            const newRow = { date: targetRow.date } as Record<string, number | string>;
            for (let h = 0; h < 24; h++) {
              newRow[`h${h}`] = (sourceRow?.[`h${h}` as keyof DayRow] as number) || 0;
            }
            return newRow as DayRow;
          }
          return targetRow;
        });
        try {
          await apiRequest("POST", "/api/stcw/import", {
            data: copiedRows,
            crewId: meta.crew_id,
            year: meta.year,
            month: targetMonth,
          });
          successCount++;
        } catch {
          /* only successful copies count */
        }
      }
      toast({
        title: "Month data copied",
        description: `Successfully copied ${meta.month} schedule to ${successCount} month(s)`,
      });
      setMonthsToCopy([]);
    } catch (error) {
      console.error("[CopyMonthToYear] Error:", error);
      toast({
        title: "Copy failed",
        description: "Failed to copy month data",
        variant: "destructive",
      });
    }
  }, [monthsToCopy, isReadyForActions, meta, rows, setMonthsToCopy, toast]);

  const removeMonths = useCallback(async () => {
    if (monthsToRemove.length === 0) {
      toast({
        title: "No months selected",
        description: "Please select at least one month to clear",
        variant: "destructive",
      });
      return;
    }
    if (!isReadyForActions) {
      toast({
        title: "Selection required",
        description: "Please select vessel and crew first",
        variant: "destructive",
      });
      return;
    }
    try {
      let successCount = 0;
      for (const targetMonth of monthsToRemove) {
        const emptyMonthData = emptyMonth(meta.year, targetMonth);
        try {
          await apiRequest("POST", "/api/stcw/import", {
            data: emptyMonthData,
            crewId: meta.crew_id,
            year: meta.year,
            month: targetMonth,
          });
          successCount++;
        } catch {
          /* only successful clears count */
        }
      }
      toast({
        title: "Month data cleared",
        description: `Successfully cleared ${successCount} month(s)`,
        variant: "default",
      });
      setMonthsToRemove([]);
    } catch {
      toast({
        title: "Clear failed",
        description: "Failed to clear month data",
        variant: "destructive",
      });
    }
  }, [monthsToRemove, isReadyForActions, meta, setMonthsToRemove, toast]);

  const upload = useCallback(async () => {
    if (!isVesselSelected) {
      toast({
        title: "Vessel required",
        description: "Please select a specific vessel before uploading data",
        variant: "destructive",
      });
      return;
    }
    if (!isCrewSelected) {
      toast({
        title: "Crew member required",
        description: "Please select a crew member before uploading data",
        variant: "destructive",
      });
      return;
    }
    setSaveStatus("saving");
    try {
      const response = await fetch("/api/stcw/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: rows,
          crewId: meta.crew_id,
          year: meta.year,
          month: meta.month,
        }),
      });
      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          message?: string;
          error?: unknown;
        } | null;
        throw new Error(
          errorData?.message ||
            (typeof errorData?.error === "string" ? errorData.error : undefined) ||
            "Upload failed"
        );
      }
      let result: ComplianceResult;
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const parsed = (await response.json()) as Record<string, unknown> | null;
        result = (
          parsed && parsed["success"] === true && "data" in parsed ? parsed["data"] : parsed
        ) as ComplianceResult;
      } else {
        const text = await response.text();
        result = { message: text || "Upload successful", success: true } as ComplianceResult;
      }
      setResult(result);
      setSaveStatus("saved");
      toast({ title: "Saved successfully", description: "Rest data saved to database" });
      queryClient.invalidateQueries({ queryKey: ["/api/stcw/rest"] });
    } catch (error) {
      setSaveStatus("unsaved");
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save rest data",
        variant: "destructive",
      });
      setResult({ error: error instanceof Error ? error.message : String(error) });
    }
  }, [isVesselSelected, isCrewSelected, rows, meta, queryClient, setSaveStatus, setResult, toast]);

  const runCheck = useCallback(async () => {
    if (!meta.crew_id) {
      toast({ title: "Please select a crew member", variant: "destructive" });
      return;
    }
    try {
      const result = await apiRequest<{ compliant?: boolean }>(
        "GET",
        `/api/stcw/compliance/${meta.crew_id}/${meta.year}/${meta.month}`
      );
      setResult(result);
      toast({
        title: "Compliance check completed",
        description: `${result.compliant ? "Compliant" : "Violations found"}`,
      });
    } catch (error) {
      toast({ title: "Compliance check failed", variant: "destructive" });
      setResult({ error: error instanceof Error ? error.message : String(error) });
    }
  }, [meta, setResult, toast]);

  const exportPdf = useCallback(async () => {
    if (!meta.crew_id) {
      toast({ title: "Please select a crew member", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch(`/api/stcw/export/${meta.crew_id}/${meta.year}/${meta.month}`);
      if (!response.ok) {
        throw new Error("Export failed");
      }
      const blob = await response.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stcw_rest_${meta.crew_id}_${meta.year}_${meta.month}.pdf`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "PDF exported successfully" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  }, [meta, toast]);

  const loadFromProposedPlan = useCallback(() => {
    try {
      if (!meta.crew_id) {
        toast({
          title: "Please select a crew member",
          description: "Select a crew member first before loading the proposed plan",
          variant: "destructive",
        });
        return;
      }
      const storedPlan = localStorage.getItem("hor_proposed_rows");
      if (!storedPlan) {
        toast({
          title: "No proposed plan found",
          description: "Generate a crew schedule first to create a proposed plan",
          variant: "destructive",
        });
        return;
      }
      const proposedPlansByCrewId = JSON.parse(storedPlan);
      if (!proposedPlansByCrewId || typeof proposedPlansByCrewId !== "object") {
        toast({
          title: "Invalid proposed plan",
          description: "The stored plan data structure is invalid",
          variant: "destructive",
        });
        return;
      }
      const crewProposedRows = proposedPlansByCrewId[meta.crew_id];
      if (!crewProposedRows || !Array.isArray(crewProposedRows) || crewProposedRows.length === 0) {
        toast({
          title: "No data for selected crew",
          description: `No proposed plan data found for the selected crew member`,
          variant: "destructive",
        });
        return;
      }
      const monthIndex = MONTHS.findIndex((m) => m.label === meta.month);
      const currentYearMonth = `${meta.year}-${(monthIndex + 1).toString().padStart(2, "0")}`;
      const filteredRows = crewProposedRows.filter(
        (row: DayRow) => row.date && row.date.startsWith(currentYearMonth)
      );
      if (filteredRows.length === 0) {
        toast({
          title: "No matching data",
          description: `No proposed plan data found for ${meta.month} ${meta.year}`,
          variant: "destructive",
        });
        return;
      }
      const mergedRows = rows.map((existingRow) => {
        const proposedRow = filteredRows.find((pr: DayRow) => pr.date === existingRow.date);
        return proposedRow || existingRow;
      });
      setRows(mergedRows);
      addToHistory(mergedRows);
      toast({
        title: "Proposed plan loaded",
        description: `Loaded ${filteredRows.length} days of schedule data for selected crew`,
      });
    } catch (error) {
      console.error("Error loading proposed plan:", error);
      toast({
        title: "Loading failed",
        description: "Failed to parse or load the proposed plan data",
        variant: "destructive",
      });
    }
  }, [meta, rows, setRows, addToHistory, toast]);

  return {
    exportCSV,
    importCSV,
    clearAll,
    applyPattern,
    applyToWeekdays,
    applyToWeekends,
    copyWeek,
    applyCustomRestToAllDays,
    copyMonthToYear,
    removeMonths,
    upload,
    runCheck,
    exportPdf,
    loadFromProposedPlan,
  };
}
