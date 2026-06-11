/**
 * Crew Certifications Routes
 * CRUD operations for crew certifications
 */

import type { Express, Request, Response } from "express";
import { insertCrewCertificationSchema } from "@shared/schema";
import type { CrewExtensionsRoutesConfig } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { dbCrewExtensionsStorage } from "../../../db/crew-extensions/index.js";

export function registerCertificationsRoutes(app: Express, config: CrewExtensionsRoutesConfig) {
  const { crewOperationRateLimit, criticalOperationRateLimit } = config;

  app.get(
    "/api/crew/certifications",
    withErrorHandling("fetch crew certifications", async (req: Request, res: Response) => {
      const { crew_id } = req.query;
      const certifications = await dbCrewExtensionsStorage.getCrewCertifications(
        crew_id as string | undefined
      );
      res.json(certifications);
    })
  );

  app.post(
    "/api/crew/certifications",
    crewOperationRateLimit,
    withErrorHandling("create crew certification", async (req: Request, res: Response) => {
      const certData = insertCrewCertificationSchema.parse(req.body);
      const certification = await dbCrewExtensionsStorage.createCrewCertification(certData);
      res.json(certification);
    })
  );

  app.put(
    "/api/crew/certifications/:id",
    withErrorHandling("update crew certification", async (req: Request, res: Response) => {
      const certData = insertCrewCertificationSchema.partial().parse(req.body);
      const certification = await dbCrewExtensionsStorage.updateCrewCertification(
        req.params["id"] ?? "",
        certData
      );
      res.json(certification);
    })
  );

  app.delete(
    "/api/crew/certifications/:id",
    criticalOperationRateLimit,
    withErrorHandling("delete crew certification", async (req: Request, res: Response) => {
      await dbCrewExtensionsStorage.deleteCrewCertification(req.params["id"] ?? "");
      res.json({ success: true });
    })
  );
}
