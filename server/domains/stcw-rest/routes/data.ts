/**
 * STCW Rest Data Routes
 *
 * Data retrieval, export, and sheet management endpoints.
 */

import { Express, Request, Response } from "express";
import { withErrorHandling } from "../../../lib/route-utils";
import { StcwRestDependencies } from "./types";
import { dbStcwStorage } from "../../../db/stcw/index.js";

export function registerDataRoutes(app: Express, deps: StcwRestDependencies): void {
  const { generatePdfFilename, renderRestPdf, incrementHorPdfExport } = deps;

  app.get(
    "/api/stcw/rest/:crewId/:year/:month",
    withErrorHandling("fetch rest data", async (req: Request, res: Response) => {
      const { crewId, year, month } = req.params;

      if (!crewId || !year || !month) {
        res.status(400).json({
          error: "crewId, year, and month are required",
        });
        return;
      }

      const restData = await dbStcwStorage.getCrewRestMonth(crewId, Number.parseInt(year), month);

      if (!restData.sheet) {
        res.status(404).json({
          error: "No rest sheet found for this crew member and month",
        });
        return;
      }

      res.json(restData);
    })
  );

  app.get(
    "/api/stcw/export/:crewId/:year/:month",
    withErrorHandling("export STCW PDF", async (req: Request, res: Response) => {
      const { crewId, year, month } = req.params;

      if (!crewId || !year || !month) {
        res.status(400).json({
          error: "crewId, year, and month are required",
        });
        return;
      }

      const restData = await dbStcwStorage.getCrewRestMonth(crewId, Number.parseInt(year), month);

      if (!restData.sheet) {
        res.status(404).json({
          error: "No rest sheet found for this crew member and month",
        });
        return;
      }

      const pdfPath = generatePdfFilename(crewId, Number.parseInt(year), month);

      await renderRestPdf(restData.sheet, restData.days, {
        outputPath: pdfPath,
        title: `STCW Hours of Rest - ${restData.sheet.crewName}`,
      });

      incrementHorPdfExport(crewId, month, Number.parseInt(year));

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="stcw_rest_${crewId}_${year}_${month}.pdf"`
      );

      const fs = await import("fs");
      const pdfBuffer = fs.readFileSync(pdfPath);
      res.send(pdfBuffer);
    })
  );

  app.get(
    "/api/crew/rest/export_pdf",
    withErrorHandling("export STCW rest PDF", async (req: Request, res: Response) => {
      const { crew_id, year, month } = req.query;

      if (!crew_id || !year || !month) {
        res.status(400).json({
          error: "crew_id, year, and month are required",
        });
        return;
      }

      const restData = await dbStcwStorage.getCrewRestMonth(
        crew_id as string,
        Number.parseInt(year as string),
        month as string
      );

      if (!restData.sheet) {
        res.status(404).json({
          ok: false,
          error: "No rest sheet found for this crew member and month",
        });
        return;
      }

      const pdfPath = generatePdfFilename(
        crew_id as string,
        Number.parseInt(year as string),
        month as string
      );

      await renderRestPdf(restData.sheet, restData.days, {
        outputPath: pdfPath,
        title: `STCW Hours of Rest - ${restData.sheet.crewName}`,
      });

      res.json({
        ok: true,
        path: pdfPath,
      });
    })
  );

  app.get(
    "/api/crew/rest/sheet",
    withErrorHandling("fetch STCW rest sheet", async (req: Request, res: Response) => {
      const { crew_id, year, month } = req.query;

      if (!crew_id || !year || !month) {
        res.status(400).json({
          error: "crew_id, year, and month are required",
        });
        return;
      }

      const restData = await dbStcwStorage.getCrewRestMonth(
        crew_id as string,
        Number.parseInt(year as string),
        month as string
      );

      if (!restData.sheet) {
        res.status(404).json({
          error: "No rest sheet found for this crew member and month",
        });
        return;
      }

      res.json(restData);
    })
  );
}
