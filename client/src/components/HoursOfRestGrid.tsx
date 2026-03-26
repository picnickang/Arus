import { useEffect } from "react";
import { useHoursOfRestData } from "@/features/crew";
import {
  SaveStatusBar,
  SetupCard,
  ComplianceSummary,
  ViewEditControls,
  CustomRestScheduleCard,
  EditingToolsCard,
  MobileRestView,
  DesktopRestGrid,
  CsvEditor,
} from "@/components/hours-of-rest";

export function HoursOfRestGrid() {
  const {
    meta, setMeta, rows, csv, setCsv, mode, setMode,
    history, historyIndex, saveStatus, viewMode, setViewMode, weekOffset, setWeekOffset,
    selectedDay, setSelectedDay, liveCheck, setLiveCheck,
    customRestStart, setCustomRestStart, customRestEnd, setCustomRestEnd,
    monthsToCopy, setMonthsToCopy, monthsToRemove, setMonthsToRemove, isDragging,
    crew, vessels, filteredCrew, isVesselSelected, isReadyForActions,
    compliance, summaryStats, displayRows,
    undo, redo, startDrag, onDrag, exportCSV, importCSV, clearAll,
    applyCustomRestToAllDays, copyMonthToYear, removeMonths, upload, runCheck, exportPdf, loadFromProposedPlan,
  } = useHoursOfRestData();

  useEffect(() => {
    if (saveStatus !== "unsaved") {
      return;
    }
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    if (mq.matches && viewMode !== "mobile") {
      setViewMode("mobile");
    }
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setViewMode("mobile");
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="space-y-6">
      <SaveStatusBar saveStatus={saveStatus} />

      <SetupCard
        meta={meta} setMeta={setMeta}
        vessels={vessels} crew={crew} filteredCrew={filteredCrew}
        isVesselSelected={isVesselSelected} isReadyForActions={isReadyForActions}
      />

      {isReadyForActions && (
        <ComplianceSummary summaryStats={summaryStats} />
      )}

      <ViewEditControls
        viewMode={viewMode} setViewMode={setViewMode}
        weekOffset={weekOffset} setWeekOffset={setWeekOffset}
        rows={rows} historyIndex={historyIndex} historyLength={history.length}
        liveCheck={liveCheck} setLiveCheck={setLiveCheck}
        undo={undo} redo={redo}
      />

      <CustomRestScheduleCard
        meta={meta}
        customRestStart={customRestStart} setCustomRestStart={setCustomRestStart}
        customRestEnd={customRestEnd} setCustomRestEnd={setCustomRestEnd}
        monthsToCopy={monthsToCopy} setMonthsToCopy={setMonthsToCopy}
        monthsToRemove={monthsToRemove} setMonthsToRemove={setMonthsToRemove}
        applyCustomRestToAllDays={applyCustomRestToAllDays}
        copyMonthToYear={copyMonthToYear} removeMonths={removeMonths}
      />

      <EditingToolsCard
        isReadyForActions={isReadyForActions}
        upload={upload} runCheck={runCheck} loadFromProposedPlan={loadFromProposedPlan}
        exportPdf={exportPdf} exportCSV={exportCSV} importCSV={importCSV} clearAll={clearAll}
      />

      {viewMode === "mobile" ? (
        <MobileRestView
          displayRows={displayRows} compliance={compliance}
          isDragging={isDragging} startDrag={startDrag} onDrag={onDrag}
        />
      ) : (
        <DesktopRestGrid
          displayRows={displayRows} compliance={compliance}
          viewMode={viewMode} weekOffset={weekOffset}
          selectedDay={selectedDay} setSelectedDay={setSelectedDay}
          liveCheck={liveCheck} startDrag={startDrag} onDrag={onDrag}
        />
      )}

      {mode === "CSV" && (
        <CsvEditor csv={csv} setCsv={setCsv} importCSV={importCSV} setMode={setMode} />
      )}
    </div>
  );
}
