export type ImportType = "equipment" | "work_orders" | "parts" | "maintenance_plans";

export interface ImportOptions {
  type: ImportType;
  filename?: string | undefined;
  dryRun?: boolean | undefined;
  feedToRag?: boolean | undefined;
  vesselId?: string | undefined;
  delimiter?: string | undefined;
}

export interface ImportResult {
  success: boolean;
  type: ImportType;
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
  warnings: string[];
  ragDocumentsCreated: number;
  dryRun: boolean;
  duration: number;
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  data?: Record<string, unknown>;
}

export type AmosImportRow = { rowNum: number; data: Record<string, unknown> };
export type AmosUpsertResult = "inserted" | "updated" | "skipped";
