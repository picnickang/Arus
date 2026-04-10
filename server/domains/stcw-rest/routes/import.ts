/**
 * STCW Rest Import Routes
 *
 * Import, compliance check, and STCW data import endpoints.
 */

import { Express, Request, Response } from "express";
import { insertCrewRestSheetSchema } from "@shared/schema";
import { withErrorHandling } from "../../../lib/route-utils";
import { StcwRestDependencies, RestDay } from "./types";
import { dbStcwStorage } from "../../../db/stcw/index.js";
import { dbCrewStorage } from "../../../db/crew/index.js";
import { db } from "../../../db/index.js";
import { idempotencyLog } from "@shared/schema-runtime";
import { eq } from "drizzle-orm";

export function registerImportRoutes(app: Express, deps: StcwRestDependencies): void {
  const {
    checkMonthCompliance,
    normalizeRestDays,
    incrementIdempotencyHit,
    incrementHorImport,
  } = deps;

  app.post("/api/crew/rest/import",
    withErrorHandling("import STCW rest data", async (req: Request, res: Response) => {
      const startTime = Date.now();

      const idempotencyKey = req.header("Idempotency-Key");
      if (idempotencyKey) {
        const existing = await db.select().from(idempotencyLog).where(eq(idempotencyLog.key, idempotencyKey)).limit(1);
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
        const lines = req.body.csv.trim().split("\n");
        const headers = lines[0].split(",");

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",");
          const row: any = { date: values[0] };

          for (let h = 0; h < 24; h++) {
            const headerIndex = headers.indexOf(`h${h}`);
            if (headerIndex >= 0) {
              row[`h${h}`] = Number.parseInt(values[headerIndex] || "0");
            }
          }
          rows.push(row);
        }
      } else if (req.body.rows) {
        rows = req.body.rows;
      }

      rows = normalizeRestDays(rows);

      const orgId = (req as any).orgId || req.header("x-org-id") || "default-org-id";
      const crewId = req.body.sheet?.crewId || req.body.sheet?.crew_id;
      const crewName = req.body.sheet?.crewName || req.body.sheet?.crew_name || "Unknown";
      const sheetData = insertCrewRestSheetSchema.parse({
        ...req.body.sheet,
        crewId,
        crewName,
        orgId,
      });

      const sheet = await dbStcwStorage.createCrewRestSheet(sheetData);

      let rowCount = 0;
      for (const dayData of rows) {
        await dbStcwStorage.upsertCrewRestDay(sheet.id, { ...dayData, orgId: sheetData.orgId });
        rowCount++;
      }

      if (idempotencyKey) {
        await db.insert(idempotencyLog).values({ key: idempotencyKey, endpoint: "/api/crew/rest/import", createdAt: new Date() }).onConflictDoNothing();
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

  app.post("/api/crew/rest/check",
    withErrorHandling("check STCW compliance", async (req: Request, res: Response) => {
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

        const restData = await dbStcwStorage.getCrewRestMonth(crew_id, Number.parseInt(year), month);
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
    })
  );

  app.get("/api/stcw/compliance/:crewId/:year/:month",
    withErrorHandling("check STCW compliance", async (req: Request, res: Response) => {
      const { crewId, year, month } = req.params;

      if (!crewId || !year || !month) {
        res.status(400).json({
          error: "crewId, year, and month are required",
        });
        return;
      }

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

      const compliance = checkMonthCompliance(restData.days);
      res.json(compliance);
    })
  );

  app.post("/api/stcw/import",
    withErrorHandling("import STCW data", async (req: Request, res: Response) => {
      const startTime = Date.now();

      const idempotencyKey = req.header("Idempotency-Key");
      if (idempotencyKey) {
        const existing = await db.select().from(idempotencyLog).where(eq(idempotencyLog.key, idempotencyKey)).limit(1);
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

      const orgId = (req as any).orgId || req.header("x-org-id") || "default-org-id";
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
        await dbStcwStorage.upsertCrewRestDay(sheet.id, { ...dayData, orgId });
        rowCount++;
      }

      if (idempotencyKey) {
        await db.insert(idempotencyLog).values({ key: idempotencyKey, endpoint: "/api/stcw/import", createdAt: new Date() }).onConflictDoNothing();
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
