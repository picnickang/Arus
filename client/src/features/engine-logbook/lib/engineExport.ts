import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format, parseISO } from "date-fns";
import type { EngineLogDaily, EngineLogHourly, EngineLogGenerator } from "../types";

export const LEGACY_TO_SCHEMA_FIELD_MAP: Record<string, string> = {
  meFuelRack: "meFuelRackPosition",
  meExhaustTemp: "meExhaustTempPort",
  meTcRpm: "meTurbochargerRpm",
  foTemp: "meFuelOilTemp",
  foPress: "meFuelOilPress",
  foViscosity: "meFuelOilViscosity",
  seawaterTemp: "seaWaterCoolingTemp",
};

export function normalizeHourlyEntry(entry: Record<string, unknown>): Partial<EngineLogHourly> {
  const normalized: Record<string, unknown> = { ...entry };

  for (const [legacyKey, schemaKey] of Object.entries(LEGACY_TO_SCHEMA_FIELD_MAP)) {
    if (legacyKey in normalized && normalized[legacyKey] !== undefined) {
      normalized[schemaKey] = normalized[legacyKey];
      delete normalized[legacyKey];
    }
  }

  return normalized as Partial<EngineLogHourly>;
}

export interface ExportPDFData {
  vesselName: string;
  date: string;
  dailySummary: Partial<EngineLogDaily>;
  hourlyEntries: Map<number, Partial<EngineLogHourly>>;
}

export interface ExportExcelData {
  vesselName: string;
  date: string;
  dailySummary: Partial<EngineLogDaily>;
  hourlyEntries: Map<number, Partial<EngineLogHourly>>;
  generatorEntries: Map<string, Partial<EngineLogGenerator>>;
}

export function exportEngineToPDF(data: ExportPDFData): void {
  const { vesselName, date, dailySummary, hourlyEntries } = data;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 15;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ENGINE ROOM LOGBOOK", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Vessel: ${vesselName}`, 14, yPos);
  doc.text(`Date: ${format(parseISO(date), "PPP")}`, pageWidth - 14, yPos, { align: "right" });
  yPos += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("MAIN ENGINE SUMMARY", 14, yPos);
  yPos += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const summaryData = [
    [
      `Running Hours: ${dailySummary.meRunningHours || "N/A"} hrs | Avg RPM: ${dailySummary.avgMeRpm || "N/A"} | Avg Load: ${dailySummary.avgMeLoad || "N/A"}%`,
    ],
    [
      `FO Consumption: ${dailySummary.foConsumption || "N/A"} MT | DO Consumption: ${dailySummary.doConsumption || "N/A"} MT | LO Consumption: ${dailySummary.loConsumption || "N/A"} L`,
    ],
    [
      `FW Produced: ${dailySummary.fwProduced || "N/A"} MT | FW Consumed: ${dailySummary.fwConsumed || "N/A"} MT`,
    ],
  ];
  summaryData.forEach((row) => {
    doc.text(row[0], 14, yPos);
    yPos += 5;
  });
  yPos += 3;

  doc.setFont("helvetica", "bold");
  doc.text("HOURLY ENGINE READINGS", 14, yPos);
  yPos += 3;

  const hourlyData = Array.from(hourlyEntries.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, entry]) => [
      `${hour.toString().padStart(2, "0")}:00`,
      entry.meRpm?.toString() || "-",
      entry.meLoad?.toString() || "-",
      entry.meExhaustTempPort?.toString() || "-",
      entry.meLubOilPress?.toString() || "-",
      entry.meLubOilTemp?.toString() || "-",
      entry.meCoolantTempIn?.toString() || "-",
      entry.meFuelOilTemp?.toString() || "-",
      entry.remarks || "",
    ]);

  autoTable(doc, {
    head: [
      ["Hour", "RPM", "Load%", "Exh.T°C", "LO Press", "LO Temp", "Cool.T", "FO T°C", "Remarks"],
    ],
    body: hourlyData,
    startY: yPos,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
  });

  doc.save(`engine-log-${vesselName}-${date}.pdf`);
}

export function exportEngineToExcel(data: ExportExcelData): void {
  const { vesselName, date, dailySummary, hourlyEntries, generatorEntries } = data;
  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet([
    {
      Vessel: vesselName,
      Date: date,
      "ME Running Hours": dailySummary.meRunningHours,
      "Avg ME RPM": dailySummary.avgMeRpm,
      "Avg ME Load %": dailySummary.avgMeLoad,
      "FO Consumption (MT)": dailySummary.foConsumption,
      "DO Consumption (MT)": dailySummary.doConsumption,
      "LO Consumption (L)": dailySummary.loConsumption,
      "FW Produced (MT)": dailySummary.fwProduced,
      "FW Consumed (MT)": dailySummary.fwConsumed,
      "Chief Engineer Remarks": dailySummary.chiefEngineerRemarks,
      Status: dailySummary.status,
    },
  ]);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  const hourlyData = Array.from(hourlyEntries.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, entry]) => ({
      Hour: `${hour.toString().padStart(2, "0")}:00`,
      "ME RPM": entry.meRpm,
      "ME Load %": entry.meLoad,
      "ME Fuel Rack": entry.meFuelRackPosition,
      "Exhaust Temp Port °C": entry.meExhaustTempPort,
      "Exhaust Temp Stbd °C": entry.meExhaustTempStbd,
      "Scav Air Press": entry.meScavAirPress,
      "Coolant Temp In": entry.meCoolantTempIn,
      "Coolant Temp Out": entry.meCoolantTempOut,
      "LO Press": entry.meLubOilPress,
      "LO Temp": entry.meLubOilTemp,
      "TC RPM": entry.meTurbochargerRpm,
      "FO Temp": entry.meFuelOilTemp,
      "FO Press": entry.meFuelOilPress,
      "Seawater Temp": entry.seaWaterCoolingTemp,
      "ER Temp": entry.engineRoomTemp,
      Remarks: entry.remarks,
    }));
  const hourlySheet = XLSX.utils.json_to_sheet(hourlyData);
  XLSX.utils.book_append_sheet(wb, hourlySheet, "Hourly Readings");

  const genData = Array.from(generatorEntries.entries()).map(([key, entry]) => {
    const [genNum, hour] = key.split("-");
    return {
      Generator: `DG${genNum}`,
      Hour: `${hour.padStart(2, "0")}:00`,
      "Load kW": entry.loadKw,
      "Voltage V": entry.voltage,
      "Frequency Hz": entry.frequency,
      "Exhaust Temp °C": entry.exhaustTemp,
      "LO Press": entry.lubOilPress,
      "Coolant Temp": entry.coolantTemp,
      "Running Hours": entry.runningHours,
      Status: entry.status,
    };
  });
  const genSheet = XLSX.utils.json_to_sheet(genData);
  XLSX.utils.book_append_sheet(wb, genSheet, "Generators");

  XLSX.writeFile(wb, `engine-log-${vesselName}-${date}.xlsx`);
}
