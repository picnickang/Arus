import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  type DayRow,
  type Crew,
  type Vessel,
  type ShiftPattern,
  type ViewMode,
  type SaveStatus,
  MONTHS,
  emptyMonth,
  toCSV,
  parseCSV,
  filterCrewByVessel,
  isGridReady,
  calculateDayCompliance,
  calculateSummaryStats,
  timeToHourPattern,
  applyPatternToRows,
  getWeekdayIndices,
  getWeekendIndices,
  copyWeekData,
  applyRestPeriodToAllDays,
  clearAllHours,
  useUndoRedoKeyboard,
} from "@/features/crew";

interface ComplianceResult {
  compliant?: boolean;
  error?: string;
  message?: string;
  success?: boolean;
}

export interface HoursOfRestMeta {
  vessel_id: string;
  crew_id: string;
  crew_name: string;
  rank: string;
  month: string;
  year: number;
}

export interface UseHoursOfRestDataReturn {
  meta: HoursOfRestMeta;
  setMeta: React.Dispatch<React.SetStateAction<HoursOfRestMeta>>;
  rows: DayRow[];
  setRows: React.Dispatch<React.SetStateAction<DayRow[]>>;
  csv: string;
  setCsv: React.Dispatch<React.SetStateAction<string>>;
  result: ComplianceResult | null;
  mode: "GRID" | "CSV";
  setMode: React.Dispatch<React.SetStateAction<"GRID" | "CSV">>;
  history: DayRow[][];
  historyIndex: number;
  saveStatus: SaveStatus;
  viewMode: ViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  weekOffset: number;
  setWeekOffset: React.Dispatch<React.SetStateAction<number>>;
  selectedDay: number | null;
  setSelectedDay: React.Dispatch<React.SetStateAction<number | null>>;
  liveCheck: boolean;
  setLiveCheck: React.Dispatch<React.SetStateAction<boolean>>;
  showSummary: boolean;
  setShowSummary: React.Dispatch<React.SetStateAction<boolean>>;
  customRestStart: string;
  setCustomRestStart: React.Dispatch<React.SetStateAction<string>>;
  customRestEnd: string;
  setCustomRestEnd: React.Dispatch<React.SetStateAction<string>>;
  monthsToCopy: string[];
  setMonthsToCopy: React.Dispatch<React.SetStateAction<string[]>>;
  monthsToRemove: string[];
  setMonthsToRemove: React.Dispatch<React.SetStateAction<string[]>>;
  isDragging: boolean;
  crew: Crew[];
  vessels: Vessel[];
  filteredCrew: Crew[];
  isVesselSelected: boolean;
  isCrewSelected: boolean;
  isReadyForActions: boolean;
  compliance: ReturnType<typeof calculateDayCompliance>;
  summaryStats: ReturnType<typeof calculateSummaryStats>;
  displayRows: DayRow[];
  undo: () => void;
  redo: () => void;
  startDrag: (dIdx: number, h: number) => void;
  onDrag: (dIdx: number, h: number) => void;
  endDrag: () => void;
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

export function useHoursOfRestData(): UseHoursOfRestDataReturn {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [meta, setMeta] = useState<HoursOfRestMeta>({
    vessel_id: "all",
    crew_id: "",
    crew_name: "",
    rank: "Chief Eng",
    month: "AUGUST",
    year: new Date().getUTCFullYear(),
  });

  const [rows, setRows] = useState<DayRow[]>(() =>
    emptyMonth(new Date().getUTCFullYear(), "AUGUST")
  );
  const [csv, setCsv] = useState<string>("");
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [mode, setMode] = useState<"GRID" | "CSV">("GRID");

  const [history, setHistory] = useState<DayRow[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef<DayRow[][]>([]);
  const historyIndexRef = useRef(-1);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [liveCheck, setLiveCheck] = useState(true);
  const [customPatterns] = useState<ShiftPattern[]>([]);
  const [showSummary, setShowSummary] = useState(true);

  const [customRestStart, setCustomRestStart] = useState("20:00");
  const [customRestEnd, setCustomRestEnd] = useState("06:00");
  const [monthsToCopy, setMonthsToCopy] = useState<string[]>([]);
  const [monthsToRemove, setMonthsToRemove] = useState<string[]>([]);

  const [isDragging, setIsDragging] = useState(false);
  const paintValueRef = useRef<number | null>(null);
  const dragStartRef = useRef<DayRow[]>([]);
  const dragStartPosRef = useRef<{ row: number; col: number } | null>(null);
  const dragEndPosRef = useRef<{ row: number; col: number } | null>(null);
  const currentRowsRef = useRef<DayRow[]>(rows);

  useEffect(() => {
    currentRowsRef.current = rows;
  }, [rows]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  const { data: crew = [] } = useQuery<Crew[]>({ queryKey: ["/api/crew"], refetchInterval: 60000 });
  const { data: vessels = [] } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
    refetchInterval: 60000,
  });

  const filteredCrew = useMemo(
    () => filterCrewByVessel(crew, meta.vessel_id),
    [crew, meta.vessel_id]
  );
  const { isVesselSelected, isCrewSelected, isReadyForActions } = useMemo(
    () => isGridReady(meta.vessel_id, meta.crew_id),
    [meta.vessel_id, meta.crew_id]
  );

  const addToHistory = useCallback(
    (newRows: DayRow[]) => {
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        return [...newHistory, JSON.parse(JSON.stringify(newRows))].slice(-20);
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 19));
      setSaveStatus("unsaved");
    },
    [historyIndex]
  );

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      const newIndex = historyIndexRef.current - 1;
      setHistoryIndex(newIndex);
      setRows(JSON.parse(JSON.stringify(historyRef.current[newIndex])));
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      const newIndex = historyIndexRef.current + 1;
      setHistoryIndex(newIndex);
      setRows(JSON.parse(JSON.stringify(historyRef.current[newIndex])));
    }
  }, []);

  useUndoRedoKeyboard(undo, redo);

  const autoSave = useCallback(async () => {
    if (!isReadyForActions) {
      return;
    }
    setSaveStatus("saving");
    try {
      const csvData = toCSV(rows);
      const response = await fetch("/api/stcw/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv: csvData,
          crewId: meta.crew_id,
          vessel: meta.vessel_id,
          year: meta.year,
          month: meta.month,
        }),
      });
      setSaveStatus(response.ok ? "saved" : "unsaved");
    } catch {
      setSaveStatus("unsaved");
    }
  }, [isReadyForActions, rows, meta]);

  useEffect(() => {
    if (saveStatus === "unsaved" && isReadyForActions) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        autoSave();
      }, 5000);
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [saveStatus, isReadyForActions, autoSave]);

  useEffect(() => {
    const emptyRows = emptyMonth(meta.year, meta.month);
    setRows(emptyRows);
    setHistory([JSON.parse(JSON.stringify(emptyRows))]);
    setHistoryIndex(0);
  }, [meta.year, meta.month]);

  useEffect(() => {
    if (meta.crew_id && crew.length > 0) {
      const selectedCrew = crew.find((c) => c.id === meta.crew_id);
      if (selectedCrew) {
        setMeta((prev) => ({ ...prev, crew_name: selectedCrew.name, rank: selectedCrew.rank }));
      }
    }
  }, [meta.crew_id, crew]);

  useEffect(() => {
    async function loadSavedRestData() {
      if (!meta.crew_id || !meta.year || !meta.month) {
        return;
      }
      try {
        const response = await fetch(`/api/stcw/rest/${meta.crew_id}/${meta.year}/${meta.month}`);
        if (response.status === 404) {
          const emptyRows = emptyMonth(meta.year, meta.month);
          setRows(emptyRows);
          setHistory([JSON.parse(JSON.stringify(emptyRows))]);
          setHistoryIndex(0);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load rest data");
        }
        const data = await response.json();
        if (data.days && Array.isArray(data.days) && data.days.length > 0) {
          const loadedRows = emptyMonth(meta.year, meta.month);
          data.days.forEach((day: DayRow) => {
            const trimmedDate = day.date.trim();
            const rowIndex = loadedRows.findIndex((r) => r.date === trimmedDate);
            if (rowIndex !== -1) {
              const row = { date: trimmedDate } as Record<string, number | string>;
              for (let h = 0; h < 24; h++) {
                row[`h${h}`] = (day[`h${h}` as keyof DayRow] as number) || 0;
              }
              loadedRows[rowIndex] = row as DayRow;
            }
          });
          setRows(loadedRows);
          setHistory([JSON.parse(JSON.stringify(loadedRows))]);
          setHistoryIndex(0);
          setSaveStatus("saved");
        } else {
          const emptyRows = emptyMonth(meta.year, meta.month);
          setRows(emptyRows);
          setHistory([JSON.parse(JSON.stringify(emptyRows))]);
          setHistoryIndex(0);
        }
      } catch (error) {
        console.error("Failed to load saved rest data:", error);
        const emptyRows = emptyMonth(meta.year, meta.month);
        setRows(emptyRows);
        setHistory([JSON.parse(JSON.stringify(emptyRows))]);
        setHistoryIndex(0);
      }
    }
    loadSavedRestData();
  }, [meta.crew_id, meta.year, meta.month]);

  const compliance = useMemo(() => calculateDayCompliance(rows), [rows]);
  const summaryStats = useMemo(() => calculateSummaryStats(rows, compliance), [compliance, rows]);

  const startDrag = useCallback(
    (dIdx: number, h: number) => {
      dragStartRef.current = JSON.parse(JSON.stringify(rows));
      dragStartPosRef.current = { row: dIdx, col: h };
      const currentValue = (rows[dIdx][`h${h}` as keyof DayRow] as number) || 0;
      const newValue = currentValue === 1 ? 0 : 1;
      paintValueRef.current = newValue;
      setIsDragging(true);
      const next = dragStartRef.current.map((r, rowIdx) =>
        rowIdx === dIdx ? { ...r, [`h${h}`]: newValue } : r
      );
      setRows(next);
    },
    [rows]
  );

  const onDrag = useCallback((dIdx: number, h: number) => {
    if (paintValueRef.current === null || !dragStartPosRef.current) {
      return;
    }
    dragEndPosRef.current = { row: dIdx, col: h };
    const startPos = dragStartPosRef.current;
    const minRow = Math.min(startPos.row, dIdx),
      maxRow = Math.max(startPos.row, dIdx);
    const minCol = Math.min(startPos.col, h),
      maxCol = Math.max(startPos.col, h);
    const next = dragStartRef.current.map((r, rowIdx) => {
      const updated = { ...r } as Record<string, number | string>;
      if (rowIdx >= minRow && rowIdx <= maxRow) {
        for (let hour = minCol; hour <= maxCol; hour++) {
          updated[`h${hour}`] = paintValueRef.current!;
        }
      }
      return updated as DayRow;
    });
    setRows(next);
  }, []);

  const endDrag = useCallback(() => {
    if (paintValueRef.current !== null && dragStartRef.current.length > 0) {
      const hasChanged =
        JSON.stringify(dragStartRef.current) !== JSON.stringify(currentRowsRef.current);
      if (hasChanged) {
        addToHistory(currentRowsRef.current);
      }
    }
    setIsDragging(false);
    paintValueRef.current = null;
    dragStartRef.current = [];
    dragStartPosRef.current = null;
    dragEndPosRef.current = null;
  }, [addToHistory]);

  useEffect(() => {
    const handleMouseUp = () => {
      endDrag();
    };
    globalThis.addEventListener("mouseup", handleMouseUp);
    globalThis.addEventListener("touchend", handleMouseUp);
    globalThis.addEventListener("touchcancel", handleMouseUp);
    return () => {
      globalThis.removeEventListener("mouseup", handleMouseUp);
      globalThis.removeEventListener("touchend", handleMouseUp);
      globalThis.removeEventListener("touchcancel", handleMouseUp);
    };
  }, [endDrag]);

  const exportCSV = useCallback(() => {
    setCsv(toCSV(rows));
    setMode("CSV");
  }, [rows]);
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
  }, [csv, addToHistory]);
  const clearAll = useCallback(() => {
    const cleared = clearAllHours(rows);
    setRows(cleared);
    addToHistory(cleared);
  }, [rows, addToHistory]);

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
    [rows, customPatterns, addToHistory, toast]
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
    [rows, addToHistory, toast]
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
  }, [rows, customRestStart, customRestEnd, meta.month, addToHistory, toast]);

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
              newRow[`h${h}`] = (sourceRow[`h${h}` as keyof DayRow] as number) || 0;
            }
            return newRow as DayRow;
          }
          return targetRow;
        });
        const response = await fetch("/api/stcw/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: copiedRows,
            crewId: meta.crew_id,
            year: meta.year,
            month: targetMonth,
          }),
        });
        if (response.ok) {
          successCount++;
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
  }, [monthsToCopy, isReadyForActions, meta, rows, toast]);

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
        const response = await fetch("/api/stcw/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: emptyMonthData,
            crewId: meta.crew_id,
            year: meta.year,
            month: targetMonth,
          }),
        });
        if (response.ok) {
          successCount++;
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
  }, [monthsToRemove, isReadyForActions, meta, toast]);

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
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Upload failed");
      }
      let result;
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        result = { message: text || "Upload successful", success: true };
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
      setResult({ error: (error as Error).message });
    }
  }, [isVesselSelected, isCrewSelected, rows, meta, queryClient, toast]);

  const runCheck = useCallback(async () => {
    if (!meta.crew_id) {
      toast({ title: "Please select a crew member", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch(
        `/api/stcw/compliance/${meta.crew_id}/${meta.year}/${meta.month}`
      );
      if (!response.ok) {
        throw new Error("Compliance check failed");
      }
      const result = await response.json();
      setResult(result);
      toast({
        title: "Compliance check completed",
        description: `${result.compliant ? "Compliant" : "Violations found"}`,
      });
    } catch (error) {
      toast({ title: "Compliance check failed", variant: "destructive" });
      setResult({ error: (error as Error).message });
    }
  }, [meta, toast]);

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
  }, [meta, rows, addToHistory, toast]);

  const weekData = useMemo(
    () => (viewMode !== "week" ? rows : rows.slice(weekOffset * 7, weekOffset * 7 + 7)),
    [rows, weekOffset, viewMode]
  );
  const displayRows = viewMode === "week" ? weekData : rows;

  return {
    meta,
    setMeta,
    rows,
    setRows,
    csv,
    setCsv,
    result,
    mode,
    setMode,
    history,
    historyIndex,
    saveStatus,
    viewMode,
    setViewMode,
    weekOffset,
    setWeekOffset,
    selectedDay,
    setSelectedDay,
    liveCheck,
    setLiveCheck,
    showSummary,
    setShowSummary,
    customRestStart,
    setCustomRestStart,
    customRestEnd,
    setCustomRestEnd,
    monthsToCopy,
    setMonthsToCopy,
    monthsToRemove,
    setMonthsToRemove,
    isDragging,
    crew,
    vessels,
    filteredCrew,
    isVesselSelected,
    isCrewSelected,
    isReadyForActions,
    compliance,
    summaryStats,
    displayRows,
    undo,
    redo,
    startDrag,
    onDrag,
    endDrag,
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
