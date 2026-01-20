import { useState, useCallback, useRef, useEffect } from "react";
import type { DayRow } from "../lib/restGridUtils";

const MAX_HISTORY = 20;

export interface GridHistoryState {
  history: DayRow[][];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  addToHistory: (rows: DayRow[]) => void;
  undo: () => DayRow[] | null;
  redo: () => DayRow[] | null;
  resetHistory: (initialRows: DayRow[]) => void;
}

export function useGridHistory(initialRows: DayRow[]): GridHistoryState {
  const [history, setHistory] = useState<DayRow[][]>([JSON.parse(JSON.stringify(initialRows))]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const historyRef = useRef<DayRow[][]>(history);
  const historyIndexRef = useRef(historyIndex);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  const addToHistory = useCallback((newRows: DayRow[]) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndexRef.current + 1);
      return [...newHistory, JSON.parse(JSON.stringify(newRows))].slice(-MAX_HISTORY);
    });
    setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
  }, []);

  const undo = useCallback((): DayRow[] | null => {
    if (historyIndexRef.current > 0) {
      const newIndex = historyIndexRef.current - 1;
      setHistoryIndex(newIndex);
      return JSON.parse(JSON.stringify(historyRef.current[newIndex]));
    }
    return null;
  }, []);

  const redo = useCallback((): DayRow[] | null => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      const newIndex = historyIndexRef.current + 1;
      setHistoryIndex(newIndex);
      return JSON.parse(JSON.stringify(historyRef.current[newIndex]));
    }
    return null;
  }, []);

  const resetHistory = useCallback((initialRows: DayRow[]) => {
    const initial = JSON.parse(JSON.stringify(initialRows));
    setHistory([initial]);
    setHistoryIndex(0);
  }, []);

  return {
    history,
    historyIndex,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    addToHistory,
    undo,
    redo,
    resetHistory,
  };
}

export function useUndoRedoKeyboard(
  undo: () => void,
  redo: () => void
): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (e.key === "y" || (e.shiftKey && e.key === "z")) {
          e.preventDefault();
          redo();
        }
      }
    };
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);
}
