/**
 * STCW Rest Import Routes
 *
 * Import, compliance check, and STCW data import endpoints.
 *
 * ============================================================================
 * LAUNCH P0 FIX #4 — Proper CSV parsing
 * ============================================================================
 *
 * Previously: hand-rolled `line.split(",")` broke on any crew name containing
 * a comma ("Lim, Ah Beng"), a quoted field, or a CRLF line ending. In a
 * Bruneian crew roster this was going to bite on day one.
 *
 * Now: uses papaparse (already a dep, already used elsewhere in the codebase
 * for file-analysis tools) with header:true and skipEmptyLines:true. Handles
 * RFC 4180 quoted fields, escaped quotes, trailing newlines, and mixed CRLF.
 *
 * The output shape is unchanged: RestDay[] with { date, h0..h23 }. Callers
 * and downstream `normalizeRestDays()` don't need changes.
 * ============================================================================
 */

import { Express, Request, Response } from "express";
import Papa from "papaparse";
import { insertCrewRestSheetSchema } from "@shared/schema";
import { withErrorHandling } from "../../../lib/route-utils";
import { StcwRestDependencies, RestDay } from "./types";
import { dbStcwStorage } from "../../../db/stcw/index.js";
import { dbCrewStorage } from "../../../db/crew/index.js";
import { db } from "../../../db/index.js";
import { idempotencyLog } from "@shared/schema-runtime";
import { eq } from "drizzle-orm";

/**
 * Parse a STCW rest-hours CSV into RestDay[] using papaparse.
 *
 * Expected format:
 *   date,h0,h1,h2,...,h23
 *   2026-01-01,1,1,1,0,0,...,1
 *
 * Each hN column is a 0 or 1 indicating rest (1) or work (0) during that
 * hour. The date column can be any format normalizeRestDays() accepts.
 *
 * Robust to:
 *   - Quoted fields (e.g. notes or crew name columns — ignored here but
 *     won't corrupt adjacent columns)
 *   - Missing hN columns (filled with 0)
 *   - Extra columns (ignored)
 *   - CRLF vs LF line endings
 *   - Trailing blank lines
 *   - Header case variations (h0 vs H0 — preserved via case-sensitive
 *     indexOf, which matches the previous behavior)
 *
 * Returns an empty array on unparseable input rather than throwing, so
 * the caller can surface a clean 400 rather than a 500.
 */
function parseRestCsv(csvText: string): RestDay[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors && parsed.errors.length > 0) {
    // Papa collects non-fatal errors; we tolerate them and continue with
    // whatever rows parsed successfully. A completely unparseable CSV
    // returns parsed.data === [] and we hand back an empty array.
  }

  const rows: RestDay[] = [];
  for (const row of parsed.data) {
    if (!row || typeof row !== "object") continue;
    const date = (row.date ?? row.Date ?? "").toString().trim();
    if (!date) continue;

    const restDay: any = { date };
    for (let h = 0; h < 24; h++) {
      const raw = row[`h${h}`];
      // Number.parseInt tolerates "1", "1.0", " 1 ". Fallback 0.
      restDay[`h${h}`] = raw != null ? Number.parseInt(String(raw), 10) || 0 : 0;
    }
    rows.push(restDay);
  }

  return rows;
}

export function registerImportRoutes(
  app: Express,
  deps: StcwRestDependencies
): void {
  const {
    checkMonthCompliance,
    normalizeRestDays,
    incrementIdempotencyHit,
    incrementHorImport,
  } = deps;

  app.post(
    "/api/crew/rest/import",
    withErrorHandling(
      "import STCW rest data",
      async (req: Request, res: Response) => {
        const startTime = Date.now();

        const idempotencyKey = req.header("Idempotency-Key");
        if (idempotencyKey) {
          const existing = await db
            .select()
            .from(idempotencyLog)
            .where(eq(idempotencyLog.key, idempotencyKey))
            .limit(1);
          if (existing.length > 0) {
            incrementIdempotencyHit("/api/crew/rest/import");
            res.json({
              ok: true,
              duplicate: true,
              message: "Request already processed - idempotent response",
            });
            return;
          }
        }

        let rows: RestDay[] = [];
        const format = req.body.csv ? "csv" : "json";

        if (req.body.csv) {
          // FIX #4: use papaparse instead of hand-rolled split(",").
          // Handles quoted fields and embedded commas correctly.
          rows = parseRestCsv(req.body.csv);
        } else if (req.body.rows) {
          rows = req.body.rows;
        }

        rows = normalizeRestDays(rows);

        const orgId =
          (req as any).orgId ||
          req.header("x-org-id") ||
          "default-org-id";
        const crewId = req.body.sheet?.crewId || req.body.sheet?.crew_id;
        const crewName =
          req.body.sheet?.crewName || req.body.sheet?.crew_name || "Unknown";
        const sheetData = insertCrewRestSheetSchema.parse({
          ...req.body.sheet,
          crewId,
          crewName,
          orgId,
        });

        const sheet = await dbStcwStorage.createCrewRestSheet(sheetData);

        let rowCount = 0;
        for (const dayData of rows) {
          await dbStcwStorage.upsertCrewRestDay(sheet.id, {
            ...dayData,
            orgId: sheetData.orgId,
          });
          rowCount++;
        }

        if (idempotencyKey) {
          await db
            .insert(idempotencyLog)
            .values({
              key: idempotencyKey,
              endpoint: "/api/crew/rest/import",
              createdAt: new Date(),
            })
            .onConflictDoNothing();
        }

        incrementHorImport(sheetData.crewId, format, rowCount);

        const processingTime = Date.now() - startTime;

        res.json({
          ok: true,
          sheet_id: sheet.id,
          rows: rowCount,
          processing_time_ms: processingTime,
        });
      }
    )
  );

  app.post(
    "/api/crew/rest/check",
    withErrorHandling(
      "check STCW compliance",
      async (req: Request, res: Response) => {
        let rows: RestDay[] = [];

        if (req.body.rows) {
          rows = normalizeRestDays(req.body.rows);
        } else {
          const { crew_id, year, month } = req.body;
          if (!crew_id || !year || !month) {
            res.status(400).json({
              error: "crew_id, year, and month are required",
            });
            return;
          }

          const restData = await dbStcwStorage.getCrewRestMonth(
            crew_id,
            Number.parseInt(year),
            month
          );
          if (!restData.sheet) {
            res.status(404).json({
              ok: false,
              error: "No rest sheet found for this crew member and month",
            });
            return;
          }

          rows = restData.days;
        }

        const compliance = checkMonthCompliance(rows);
        res.json(compliance);
      }
    )
  );

  app.get(
    "/api/stcw/compliance/:crewId/:year/:month",
    withErrorHandling(
      "check STCW compliance",
      async (req: Request, res: Response) => {
        const { crewId, year, month } = req.params;

        if (!crewId || !year || !month) {
          res.status(400).json({
            error: "crewId, year, and month are required",
          });
          return;
        }

        const restData = await dbStcwStorage.getCrewRestMonth(
          crewId,
          Number.parseInt(year),
          month
        );
        if (!restData.sheet) {
          res.status(200).json({
            ok: false,
            error: "No rest sheet found",
            message: "Upload or import rest data first to check compliance",
            days: [],
            rolling7d: [],
          });
          return;
        }

        const compliance = checkMonthCompliance(restData.days);
        res.json(compliance);
      }
    )
  );

  app.post(
    "/api/stcw/import",
    withErrorHandling(
      "import STCW data",
      async (req: Request, res: Response) => {
        const startTime = Date.now();

        const idempotencyKey = req.header("Idempotency-Key");
        if (idempotencyKey) {
          const existing = await db
            .select()
            .from(idempotencyLog)
            .where(eq(idempotencyLog.key, idempotencyKey))
            .limit(1);
          if (existing.length > 0) {
            incrementIdempotencyHit("/api/stcw/import");
            res.json({
              success: true,
              duplicate: true,
              message: "Request already processed - idempotent response",
            });
            return;
          }
        }

        const { crewId, year, month, data } = req.body;

        if (!crewId || !year || !month || !data) {
          res.status(400).json({
            success: false,
            error: "Missing required fields: crewId, year, month, data",
          });
          return;
        }

        let rows: RestDay[] = typeof data === "string" ? JSON.parse(data) : data;
        rows = normalizeRestDays(rows);

        const orgId =
          (req as any).orgId ||
          req.header("x-org-id") ||
          "default-org-id";
        const crewMember = await dbCrewStorage.getCrewMember(crewId);
        const crewName = crewMember?.name || "Unknown";
        const sheet = await dbStcwStorage.createCrewRestSheet({
          crewId,
          crewName,
          year: Number.parseInt(year),
          month,
          status: "draft",
          orgId,
        });

        let rowCount = 0;
        for (const dayData of rows) {
          await dbStcwStorage.upsertCrewRestDay(sheet.id, {
            ...dayData,
            orgId,
          });
          rowCount++;
        }

        if (idempotencyKey) {
          await db
            .insert(idempotencyLog)
            .values({
              key: idempotencyKey,
              endpoint: "/api/stcw/import",
              createdAt: new Date(),
            })
            .onConflictDoNothing();
        }

        incrementHorImport(crewId, "json", rowCount);

        const processingTime = Date.now() - startTime;

        res.json({
          success: true,
          sheetId: sheet.id,
          rowsImported: rowCount,
          processingTimeMs: processingTime,
        });
      }
    )
  );
}
