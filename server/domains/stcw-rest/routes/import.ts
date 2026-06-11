/**
 * STCW Rest Import Routes
 *
 * Import, compliance check, and STCW data import endpoints.
 */

import { Express, Request, Response } from "express";
import { z } from "zod";
import { jsonValueSchema } from "@shared/validation/json";
import { authenticatedRequest } from "../../../middleware/auth";
import Papa from "papaparse";
import { insertCrewRestSheetSchema } from "@shared/schema";
import { withErrorHandling } from "../../../lib/route-utils";
import { StcwRestDependencies, RestDay } from "./types";
import { dbStcwStorage } from "../../../db/stcw/index.js";
import { dbCrewStorage } from "../../../db/crew/index.js";
import { db } from "../../../db/index.js";
import { idempotencyLog } from "@shared/schema-runtime";
import { eq } from "drizzle-orm";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

function parseRestCsv(csvText: string): RestDay[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors && parsed.errors.length > 0) {
    // tolerated
  }

  const rows: RestDay[] = [];
  for (const row of parsed.data) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const date = (row["date"] ?? row["Date"] ?? "").toString().trim();
    if (!date) {
      continue;
    }

    const restDay: RestDay = { date };
    for (let h = 0; h < 24; h++) {
      const raw = row[`h${h}`];
      restDay[`h${h}`] = raw != null ? Number.parseInt(String(raw), 10) || 0 : 0;
    }
    rows.push(restDay);
  }

  return rows;
}

const restDayShape = z.object({ date: z.string() }).catchall(z.union([z.number(), z.string()]));

const importBodySchema = z.object({
  csv: z.string().optional(),
  rows: z.array(restDayShape).optional(),
  sheet: z
    .object({
      crewId: z.string().optional(),
      crew_id: z.string().optional(),
      crewName: z.string().optional(),
      crew_name: z.string().optional(),
    })
    .optional(),
});

const checkBodySchema = z.object({
  rows: z.array(restDayShape).optional(),
  crew_id: z.string().optional(),
  year: z.union([z.string(), z.number()]).optional(),
  month: z.union([z.string(), z.number()]).optional(),
});

const complianceParamSchema = z.object({
  crewId: z.string().min(1),
  year: z.string().min(1),
  month: z.string().min(1),
});

const stcwImportBodySchema = z.object({
  crewId: z.string().min(1),
  year: z.union([z.string(), z.number()]),
  month: z.union([z.string(), z.number()]),
  data: z.union([z.string(), z.array(jsonValueSchema)]),
});

export function registerImportRoutes(app: Express, deps: StcwRestDependencies): void {
  const { checkMonthCompliance, normalizeRestDays, incrementIdempotencyHit, incrementHorImport } =
    deps;

  app.post(
    "/api/crew/rest/import",
    withErrorHandling("import STCW rest data", async (req: Request, res: Response) => {
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

      const body = importBodySchema.parse(req.body);

      let rows: RestDay[] = [];
      const format = body.csv ? "csv" : "json";

      if (body.csv) {
        rows = parseRestCsv(body.csv);
      } else if (body.rows) {
        rows = body.rows as RestDay[];
      }

      rows = normalizeRestDays(rows);

      const orgId = authenticatedRequest(req).orgId || DEFAULT_ORG_ID;
      const crewId = body.sheet?.crewId || body.sheet?.crew_id;
      const crewName = body.sheet?.crewName || body.sheet?.crew_name || "Unknown";
      const sheetData = insertCrewRestSheetSchema.parse({
        ...body.sheet,
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
        await db.insert(idempotencyLog).values({ key: idempotencyKey }).onConflictDoNothing();
      }

      incrementHorImport(sheetData.crewId, format, rowCount);

      const processingTime = Date.now() - startTime;

      res.json({
        ok: true,
        sheet_id: sheet.id,
        rows: rowCount,
        processing_time_ms: processingTime,
      });
    })
  );

  app.post(
    "/api/crew/rest/check",
    withErrorHandling("check STCW compliance", async (req: Request, res: Response) => {
      const body = checkBodySchema.parse(req.body);
      let rows: RestDay[] = [];

      if (body.rows) {
        rows = normalizeRestDays(body.rows as RestDay[]);
      } else {
        const { crew_id, year, month } = body;
        if (!crew_id || !year || !month) {
          res.status(400).json({
            error: "crew_id, year, and month are required",
          });
          return;
        }

        const restData = await dbStcwStorage.getCrewRestMonth(
          crew_id,
          Number.parseInt(String(year)),
          String(month)
        );
        if (!restData.sheet) {
          res.status(404).json({
            ok: false,
            error: "No rest sheet found for this crew member and month",
          });
          return;
        }

        rows = restData.days as RestDay[];
      }

      const compliance = checkMonthCompliance(rows);
      res.json(compliance);
    })
  );

  app.get(
    "/api/stcw/compliance/:crewId/:year/:month",
    withErrorHandling("check STCW compliance", async (req: Request, res: Response) => {
      const { crewId, year, month } = complianceParamSchema.parse(req.params);

      const restData = await dbStcwStorage.getCrewRestMonth(crewId, Number.parseInt(year), month);
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

      const compliance = checkMonthCompliance(restData.days as RestDay[]);
      res.json(compliance);
    })
  );

  app.post(
    "/api/stcw/import",
    withErrorHandling("import STCW data", async (req: Request, res: Response) => {
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

      const parsed = stcwImportBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: "Missing required fields: crewId, year, month, data",
        });
        return;
      }
      const { crewId, year, month, data } = parsed.data;

      let rows: RestDay[] = typeof data === "string" ? JSON.parse(data) : (data as RestDay[]);
      rows = normalizeRestDays(rows);

      const orgId = authenticatedRequest(req).orgId || DEFAULT_ORG_ID;
      const crewMember = await dbCrewStorage.getCrewMember(crewId);
      const crewName = crewMember?.name || "Unknown";
      const sheet = await dbStcwStorage.createCrewRestSheet({
        crewId,
        crewName,
        year: Number.parseInt(String(year)),
        month: String(month),
        sourceType: "manual",
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
        await db.insert(idempotencyLog).values({ key: idempotencyKey }).onConflictDoNothing();
      }

      incrementHorImport(crewId, "json", rowCount);

      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        sheetId: sheet.id,
        rowsImported: rowCount,
        processingTimeMs: processingTime,
      });
    })
  );
}
