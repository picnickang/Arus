import { apiRequest } from "@/lib/queryClient";
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
  emptyMonth,
  toCSV,
  filterCrewByVessel,
  isGridReady,
  calculateDayCompliance,
  calculateSummaryStats,
  useUndoRedoKeyboard,
} from "@/features/crew";
import { useHoursOfRestActions } from "./useHoursOfRestActions";
import type {
  ComplianceResult,
  HoursOfRestMeta,
  UseHoursOfRestDataReturn,
} from "./useHoursOfRestDataTypes";

export type {
  ComplianceResult,
  HoursOfRestMeta,
  UseHoursOfRestDataReturn,
} from "./useHoursOfRestDataTypes";

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
      await apiRequest("POST", "/api/stcw/import", {
        csv: csvData,
        crewId: meta.crew_id,
        vessel: meta.vessel_id,
        year: meta.year,
        month: meta.month,
      });
      setSaveStatus("saved");
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
        // A 404 (no sheet yet) throws and lands in the catch below, which
        // seeds the same empty month the dedicated branch used to.
        const data = await apiRequest<{ days?: DayRow[] }>(
          "GET",
          `/api/stcw/rest/${meta.crew_id}/${meta.year}/${meta.month}`
        );
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
      const currentValue = (rows[dIdx]?.[`h${h}` as keyof DayRow] as number) || 0;
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

  const {
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
  } = useHoursOfRestActions({
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
  });

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
