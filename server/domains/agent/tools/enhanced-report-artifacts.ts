import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { convertToCSV } from "./enhanced-report-formatters";

const REPORT_ARTIFACTS_DIR = join(process.cwd(), ".data", "report-artifacts");
const REGISTRY_FILE = join(REPORT_ARTIFACTS_DIR, "_registry.json");

export interface ReportArtifactMeta {
  reportId: string;
  orgId: string;
  userId?: string | undefined;
  fileName: string;
  filePath: string;
  format: string;
  reportType: string;
  createdAt: string;
}

const reportArtifactRegistry = new Map<string, ReportArtifactMeta>();
let registryLoaded = false;

async function loadRegistry(): Promise<void> {
  if (registryLoaded) {
    return;
  }
  registryLoaded = true;
  try {
    const { readFile } = await import("node:fs/promises");
    const data = await readFile(REGISTRY_FILE, "utf-8");
    const entries = JSON.parse(data) as ReportArtifactMeta[];
    for (const entry of entries) {
      reportArtifactRegistry.set(entry.reportId, entry);
    }
  } catch {
    // File doesn't exist yet or is corrupt — start fresh
  }
}

async function saveRegistry(): Promise<void> {
  await mkdir(REPORT_ARTIFACTS_DIR, { recursive: true });
  const entries = Array.from(reportArtifactRegistry.values());
  const { writeFile: wf } = await import("node:fs/promises");
  await wf(REGISTRY_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

loadRegistry();

export function getReportArtifact(reportId: string): ReportArtifactMeta | undefined {
  return reportArtifactRegistry.get(reportId);
}

export async function storeReportArtifact(
  reportId: string,
  orgId: string,
  userId: string | undefined,
  reportType: string,
  content: string,
  jsonData: Record<string, unknown>,
  format: string,
  pdfBuffer?: Buffer
): Promise<{ filePath: string; fileName: string }> {
  await mkdir(REPORT_ARTIFACTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  let fileName: string;
  let filePath: string;

  if (format === "pdf" && pdfBuffer) {
    fileName = `report-${timestamp}-${reportId}.pdf`;
    filePath = join(REPORT_ARTIFACTS_DIR, fileName);
    await writeFile(filePath, pdfBuffer);
  } else if (format === "json") {
    fileName = `report-${timestamp}-${reportId}.json`;
    filePath = join(REPORT_ARTIFACTS_DIR, fileName);
    await writeFile(filePath, JSON.stringify(jsonData, null, 2), "utf-8");
  } else if (format === "csv") {
    fileName = `report-${timestamp}-${reportId}.csv`;
    filePath = join(REPORT_ARTIFACTS_DIR, fileName);
    const csvContent = convertToCSV(jsonData);
    await writeFile(filePath, csvContent, "utf-8");
  } else {
    fileName = `report-${timestamp}-${reportId}.txt`;
    filePath = join(REPORT_ARTIFACTS_DIR, fileName);
    await writeFile(filePath, content, "utf-8");
  }

  const meta: ReportArtifactMeta = {
    reportId,
    orgId,
    userId,
    fileName,
    filePath,
    format,
    reportType,
    createdAt: new Date().toISOString(),
  };
  reportArtifactRegistry.set(reportId, meta);
  await saveRegistry();

  return { filePath, fileName };
}
