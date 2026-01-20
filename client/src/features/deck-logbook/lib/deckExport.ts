import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format, parseISO } from "date-fns";
import type { DeckLogDaily } from "../types";
import { WATCH_PERIODS } from "./deckConstants";

interface HourlyEntry {
  hour: number;
  course?: string;
  windDirection?: string;
  windForce?: string;
  seaState?: string;
  visibility?: string;
  barometer?: number;
  airTemp?: number;
  seaTemp?: number;
  remarks?: string;
}

interface WatchEntry {
  officerName?: string;
  officerRank?: string;
  helmName?: string;
  lookoutName?: string;
  watchRemarks?: string;
}

interface DailySummary {
  noonPositionLat?: number;
  noonPositionLon?: number;
  distanceMade?: number;
  distanceToGo?: number;
  avgSpeed?: number;
  steamingTime?: number;
  nextPort?: string;
  eta?: string;
  remarks?: string;
}

interface ExportDeckLogEvent {
  timestamp: Date;
  eventType: string;
  source: string;
  summary: string;
  details?: string;
  positionLat?: number;
  positionLon?: number;
}

export interface ExportDeckPDFData {
  vesselName: string;
  date: string;
  dailySummary: DailySummary;
  hourlyEntries: Map<number, HourlyEntry>;
  watchAssignments: Map<string, WatchEntry>;
  events: ExportDeckLogEvent[];
  daily: DeckLogDaily;
  getEventTypeConfig: (eventType: string) => { label: string };
}

export interface ExportDeckExcelData {
  vesselName: string;
  date: string;
  dailySummary: DailySummary;
  hourlyEntries: Map<number, HourlyEntry>;
  watchAssignments: Map<string, WatchEntry>;
  events: ExportDeckLogEvent[];
  daily: DeckLogDaily;
  getEventTypeConfig: (eventType: string) => { label: string };
}

export function exportDeckToPDF(data: ExportDeckPDFData): void {
  const { vesselName, date, dailySummary, hourlyEntries, watchAssignments, events, daily, getEventTypeConfig } = data;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 15;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("DECK LOGBOOK", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Vessel: ${vesselName}`, 14, yPos);
  doc.text(`Date: ${format(parseISO(date), "PPP")}`, pageWidth - 14, yPos, { align: "right" });
  yPos += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("DAILY NAVIGATION SUMMARY", 14, yPos);
  yPos += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const summaryData = [
    [`Noon Position: ${dailySummary.noonPositionLat || "N/A"} / ${dailySummary.noonPositionLon || "N/A"}`],
    [`Distance Made: ${dailySummary.distanceMade || "N/A"} nm | Distance to Go: ${dailySummary.distanceToGo || "N/A"} nm | Avg Speed: ${dailySummary.avgSpeed || "N/A"} kn`],
    [`Steaming Time: ${dailySummary.steamingTime || "N/A"} hrs | Next Port: ${dailySummary.nextPort || "N/A"} | ETA: ${dailySummary.eta || "N/A"}`],
  ];
  summaryData.forEach(row => {
    doc.text(row[0], 14, yPos);
    yPos += 5;
  });
  yPos += 3;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("HOURLY NAVIGATION & WEATHER LOG (UTC)", 14, yPos);
  yPos += 4;

  const hourlyRows = Array.from({ length: 24 }, (_, i) => {
    const entry = hourlyEntries.get(i) ?? {};
    return [
      `${String(i).padStart(2, "0")}:00`,
      entry.course || "-",
      entry.windDirection || "-",
      entry.windForce ? `Bf ${entry.windForce}` : "-",
      entry.seaState || "-",
      entry.visibility || "-",
      entry.barometer?.toString() || "-",
      entry.airTemp?.toString() || "-",
      entry.seaTemp?.toString() || "-",
      entry.remarks || "-",
    ];
  });

  autoTable(doc, {
    head: [["Hour", "Course", "Wind Dir", "Wind Force", "Sea State", "Visibility", "Baro (mb)", "Air °C", "Sea °C", "Remarks"]],
    body: hourlyRows,
    startY: yPos,
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 1.5 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: { 9: { cellWidth: 40 } },
  });

  doc.addPage();
  yPos = 15;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("EVENT TIMELINE", 14, yPos);
  yPos += 6;

  if (events?.length > 0) {
    const eventRows = events.map(event => [
      format(new Date(event.timestamp), "HH:mm"),
      getEventTypeConfig(event.eventType).label,
      event.summary,
      event.source,
      event.positionLat && event.positionLon ? `${event.positionLat.toFixed(4)}, ${event.positionLon.toFixed(4)}` : "-",
    ]);

    autoTable(doc, {
      head: [["Time", "Event Type", "Description", "Source", "Position"]],
      body: eventRows,
      startY: yPos,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 3 },
    });
    
    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("No events recorded for this day.", 14, yPos);
    yPos += 10;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("WATCH ASSIGNMENTS", 14, yPos);
  yPos += 6;

  const watchRows = WATCH_PERIODS.map(period => {
    const watch = watchAssignments.get(period) ?? {};
    return [
      period,
      watch.officerName || "-",
      watch.officerRank || "-",
      watch.helmName || "-",
      watch.lookoutName || "-",
      watch.watchRemarks || "-",
    ];
  });

  autoTable(doc, {
    head: [["Watch Period", "Officer of Watch", "Rank", "Helmsman", "Lookout", "Remarks"]],
    body: watchRows,
    startY: yPos,
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("REMARKS & EVENTS", 14, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(dailySummary.remarks || "No remarks recorded for this day.", 14, yPos, { maxWidth: pageWidth - 28 });
  yPos += 15;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("SIGNATURE", 14, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (daily.status === "signed") {
    doc.text(`Signed by: ${daily.signedByName || "N/A"} (${daily.signedByRank || "N/A"})`, 14, yPos);
    yPos += 5;
    doc.text(`Signed at: ${daily.signedAt ? format(new Date(daily.signedAt), "PPpp") : "N/A"}`, 14, yPos);
  } else {
    doc.text("Status: DRAFT - Not yet signed", 14, yPos);
  }

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`Generated: ${format(new Date(), "PPpp")} | ARUS Digital Deck Logbook`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });

  doc.save(`deck-log-${vesselName}-${date}.pdf`);
}

export function exportDeckToExcel(data: ExportDeckExcelData): void {
  const { vesselName, date, dailySummary, hourlyEntries, watchAssignments, events, daily, getEventTypeConfig } = data;
  const wb = XLSX.utils.book_new();

  const summaryData = [
    ["DECK LOGBOOK - DAILY SUMMARY"],
    [],
    ["Vessel", vesselName],
    ["Date", format(parseISO(date), "PPP")],
    ["Status", daily.status === "signed" ? "Signed" : "Draft"],
    [],
    ["NAVIGATION SUMMARY"],
    ["Noon Position (Lat)", dailySummary.noonPositionLat || ""],
    ["Noon Position (Lon)", dailySummary.noonPositionLon || ""],
    ["Distance Made (nm)", dailySummary.distanceMade || ""],
    ["Distance to Go (nm)", dailySummary.distanceToGo || ""],
    ["Average Speed (kn)", dailySummary.avgSpeed || ""],
    ["Steaming Time (hrs)", dailySummary.steamingTime || ""],
    ["Next Port", dailySummary.nextPort || ""],
    ["ETA", dailySummary.eta || ""],
    [],
    ["REMARKS"],
    [dailySummary.remarks || "No remarks"],
    [],
    ["SIGNATURE"],
    ["Signed By", daily.signedByName || "Not signed"],
    ["Rank", daily.signedByRank || ""],
    ["Signed At", daily.signedAt ? format(new Date(daily.signedAt), "PPpp") : ""],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 25 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Daily Summary");

  const hourlyHeaders = ["Hour (UTC)", "Course", "Wind Direction", "Wind Force (Bf)", "Sea State", "Visibility", "Barometer (mb)", "Air Temp (°C)", "Sea Temp (°C)", "Remarks"];
  const hourlyData: (string | number | undefined)[][] = [hourlyHeaders];
  for (let i = 0; i < 24; i++) {
    const entry = hourlyEntries.get(i) ?? {};
    hourlyData.push([
      `${String(i).padStart(2, "0")}:00`,
      entry.course || "",
      entry.windDirection || "",
      entry.windForce || "",
      entry.seaState || "",
      entry.visibility || "",
      entry.barometer?.toString() || "",
      entry.airTemp?.toString() || "",
      entry.seaTemp?.toString() || "",
      entry.remarks || "",
    ]);
  }
  const wsHourly = XLSX.utils.aoa_to_sheet(hourlyData);
  wsHourly["!cols"] = Array(10).fill({ wch: 15 });
  XLSX.utils.book_append_sheet(wb, wsHourly, "Hourly Log");

  const watchData: (string | undefined)[][] = [["Watch Period", "Officer of Watch", "Rank", "Helmsman", "Lookout", "Remarks"]];
  WATCH_PERIODS.forEach(period => {
    const watch = watchAssignments.get(period) ?? {};
    watchData.push([
      period,
      watch.officerName || "",
      watch.officerRank || "",
      watch.helmName || "",
      watch.lookoutName || "",
      watch.watchRemarks || "",
    ]);
  });
  const wsWatch = XLSX.utils.aoa_to_sheet(watchData);
  wsWatch["!cols"] = Array(6).fill({ wch: 20 });
  XLSX.utils.book_append_sheet(wb, wsWatch, "Watch Assignments");

  if (events?.length > 0) {
    const eventData: (string | number | undefined)[][] = [["Time", "Event Type", "Description", "Source", "Latitude", "Longitude"]];
    events.forEach(event => {
      eventData.push([
        format(new Date(event.timestamp), "HH:mm"),
        getEventTypeConfig(event.eventType).label,
        event.summary,
        event.source,
        event.positionLat?.toString() || "",
        event.positionLon?.toString() || "",
      ]);
    });
    const wsEvents = XLSX.utils.aoa_to_sheet(eventData);
    wsEvents["!cols"] = [{ wch: 10 }, { wch: 15 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsEvents, "Events");
  }

  XLSX.writeFile(wb, `deck-log-${vesselName}-${date}.xlsx`);
}
