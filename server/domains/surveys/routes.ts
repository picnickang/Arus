import type { Express, Request, Response } from "express";
import { z } from "zod";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../lib/route-utils";
import { logger } from "../../utils/logger";

const surveyTypeEnum = z.enum(["annual", "intermediate", "special", "renewal", "docking", "bottom"]);
const classSocietyEnum = z.enum(["DNV", "LR", "BV", "ABS", "ClassNK", "RINA", "CCS", "KR", "Other"]);
const statusEnum = z.enum(["due", "overdue", "in_progress", "completed", "deferred"]);

const createSurveySchema = z.object({
  vesselId: z.string().uuid(),
  surveyType: surveyTypeEnum,
  classSociety: classSocietyEnum,
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scope: z.string().optional(),
  surveyorName: z.string().optional(),
});

const updateSurveySchema = z.object({
  status: statusEnum.optional(),
  completedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  surveyorName: z.string().optional(),
  surveyorNotes: z.string().optional(),
  scope: z.string().optional(),
  findings: z.array(z.object({
    description: z.string(),
    severity: z.enum(["observation", "non_conformity", "major_non_conformity"]),
    status: z.enum(["open", "closed", "deferred"]),
  })).optional(),
});

export function registerSurveyRoutes(
  app: Express,
  deps: { storage: any; generalApiRateLimit: any; writeOperationRateLimit: any }
): void {
  const { storage, generalApiRateLimit, writeOperationRateLimit } = deps;

  app.get("/api/surveys", generalApiRateLimit,
    withErrorHandling("list surveys", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      if (!orgId) return res.status(401).json({ message: "Organization ID required" });

      const { vesselId, status, dueBefore } = req.query;

      try {
        const { db } = await import("../../db");
        const { sql } = await import("drizzle-orm");

        let result;
        if (vesselId && status && dueBefore) {
          result = await db.execute(sql`SELECT * FROM class_surveys WHERE org_id = ${orgId} AND vessel_id = ${vesselId as string} AND status = ${status as string} AND due_date <= ${dueBefore as string} ORDER BY due_date ASC`);
        } else if (vesselId && status) {
          result = await db.execute(sql`SELECT * FROM class_surveys WHERE org_id = ${orgId} AND vessel_id = ${vesselId as string} AND status = ${status as string} ORDER BY due_date ASC`);
        } else if (vesselId && dueBefore) {
          result = await db.execute(sql`SELECT * FROM class_surveys WHERE org_id = ${orgId} AND vessel_id = ${vesselId as string} AND due_date <= ${dueBefore as string} ORDER BY due_date ASC`);
        } else if (status && dueBefore) {
          result = await db.execute(sql`SELECT * FROM class_surveys WHERE org_id = ${orgId} AND status = ${status as string} AND due_date <= ${dueBefore as string} ORDER BY due_date ASC`);
        } else if (vesselId) {
          result = await db.execute(sql`SELECT * FROM class_surveys WHERE org_id = ${orgId} AND vessel_id = ${vesselId as string} ORDER BY due_date ASC`);
        } else if (status) {
          result = await db.execute(sql`SELECT * FROM class_surveys WHERE org_id = ${orgId} AND status = ${status as string} ORDER BY due_date ASC`);
        } else if (dueBefore) {
          result = await db.execute(sql`SELECT * FROM class_surveys WHERE org_id = ${orgId} AND due_date <= ${dueBefore as string} ORDER BY due_date ASC`);
        } else {
          result = await db.execute(sql`SELECT * FROM class_surveys WHERE org_id = ${orgId} ORDER BY due_date ASC`);
        }
        res.json(result?.rows ?? []);
      } catch (error) {
        if (error instanceof Error && error.message.includes("does not exist")) {
          res.json([]);
        } else {
          throw error;
        }
      }
    })
  );

  app.post("/api/surveys", writeOperationRateLimit,
    withErrorHandling("create survey", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      if (!orgId) return res.status(401).json({ message: "Organization ID required" });

      const parsed = createSurveySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }

      const { vesselId, surveyType, classSociety, dueDate, scope, surveyorName } = parsed.data;

      try {
        const { db } = await import("../../db");
        const { sql } = await import("drizzle-orm");
        const result = await db.execute(sql`
          INSERT INTO class_surveys (org_id, vessel_id, survey_type, class_society, due_date, scope, surveyor_name)
          VALUES (${orgId}, ${vesselId}, ${surveyType}, ${classSociety}, ${dueDate}, ${scope ?? null}, ${surveyorName ?? null})
          RETURNING *
        `);
        sendCreated(res, result?.rows?.[0] ?? {});
      } catch (error) {
        if (error instanceof Error && error.message.includes("does not exist")) {
          return res.status(503).json({ message: "Survey tracking table not yet created. Run the class_surveys migration first." });
        }
        throw error;
      }
    })
  );

  app.get("/api/surveys/:id", generalApiRateLimit,
    withErrorHandling("get survey", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      if (!orgId) return res.status(401).json({ message: "Organization ID required" });

      try {
        const { db } = await import("../../db");
        const { sql } = await import("drizzle-orm");
        const result = await db.execute(sql`
          SELECT * FROM class_surveys WHERE id = ${req.params.id} AND org_id = ${orgId}
        `);
        const survey = result?.rows?.[0];
        if (!survey) return sendNotFound(res, "Survey");
        res.json(survey);
      } catch (error) {
        if (error instanceof Error && error.message.includes("does not exist")) {
          return sendNotFound(res, "Survey");
        }
        throw error;
      }
    })
  );

  app.patch("/api/surveys/:id", writeOperationRateLimit,
    withErrorHandling("update survey", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      if (!orgId) return res.status(401).json({ message: "Organization ID required" });

      const parsed = updateSurveySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }

      const data = parsed.data;
      try {
        const { db } = await import("../../db");
        const { sql } = await import("drizzle-orm");

        const result = await db.execute(sql`
          UPDATE class_surveys SET
            status = COALESCE(${data.status ?? null}, status),
            completed_date = COALESCE(${data.completedDate ?? null}, completed_date),
            surveyor_name = COALESCE(${data.surveyorName ?? null}, surveyor_name),
            surveyor_notes = COALESCE(${data.surveyorNotes ?? null}, surveyor_notes),
            scope = COALESCE(${data.scope ?? null}, scope),
            findings = COALESCE(${data.findings ? JSON.stringify(data.findings) : null}::jsonb, findings),
            updated_at = NOW()
          WHERE id = ${req.params.id} AND org_id = ${orgId} RETURNING *
        `);
        const survey = result?.rows?.[0];
        if (!survey) return sendNotFound(res, "Survey");
        res.json(survey);
      } catch (error) {
        if (error instanceof Error && error.message.includes("does not exist")) {
          return res.status(503).json({ message: "Survey tracking table not yet created." });
        }
        throw error;
      }
    })
  );

  app.delete("/api/surveys/:id", writeOperationRateLimit,
    withErrorHandling("delete survey", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      if (!orgId) return res.status(401).json({ message: "Organization ID required" });

      try {
        const { db } = await import("../../db");
        const { sql } = await import("drizzle-orm");
        const result = await db.execute(sql`
          DELETE FROM class_surveys WHERE id = ${req.params.id} AND org_id = ${orgId} RETURNING id
        `);
        if (!result?.rows?.length) return sendNotFound(res, "Survey");
        sendDeleted(res);
      } catch (error) {
        if (error instanceof Error && error.message.includes("does not exist")) {
          return sendNotFound(res, "Survey");
        }
        throw error;
      }
    })
  );

  logger.info("SurveyRoutes", "Class survey tracking routes registered");
}
