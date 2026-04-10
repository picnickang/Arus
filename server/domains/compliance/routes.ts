import type { Express, Request, Response } from "express";
import { db } from "../../db-config";
import { sql } from "drizzle-orm";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

const complianceRepo = {
  async getComplianceFindings(orgId: string, filters?: any) {
    const result = await db.execute(sql`SELECT * FROM compliance_findings WHERE org_id = ${orgId} ${filters?.vesselId ? sql`AND vessel_id = ${filters.vesselId}` : sql``} ${filters?.sourceType ? sql`AND source_type = ${filters.sourceType}` : sql``} ${filters?.severity ? sql`AND severity = ${filters.severity}` : sql``} ${filters?.status ? sql`AND status = ${filters.status}` : sql``} ${filters?.ruleCode ? sql`AND rule_code = ${filters.ruleCode}` : sql``} ${filters?.startDate ? sql`AND found_at >= ${filters.startDate}::timestamp` : sql``} ${filters?.endDate ? sql`AND found_at <= ${filters.endDate}::timestamp` : sql``} ORDER BY found_at DESC`);
    return result.rows;
  },
  async getComplianceFindingById(id: string, orgId: string) {
    const result = await db.execute(sql`SELECT * FROM compliance_findings WHERE id = ${id} AND org_id = ${orgId}`);
    return result.rows[0];
  },
  async createComplianceFinding(data: any) {
    const result = await db.execute(sql`INSERT INTO compliance_findings (org_id, vessel_id, source_type, severity, status, rule_code, title, description, found_at) VALUES (${data.orgId}, ${data.vesselId}, ${data.sourceType}, ${data.severity}, ${data.status || 'open'}, ${data.ruleCode}, ${data.title}, ${data.description}, NOW()) RETURNING *`);
    return result.rows[0];
  },
  async acknowledgeComplianceFinding(id: string, _details: any, orgId: string) {
    const result = await db.execute(sql`UPDATE compliance_findings SET status = 'acknowledged' WHERE id = ${id} AND org_id = ${orgId} RETURNING *`);
    return result.rows[0];
  },
  async resolveComplianceFinding(id: string, _details: any, orgId: string) {
    const result = await db.execute(sql`UPDATE compliance_findings SET status = 'resolved', resolved_at = NOW() WHERE id = ${id} AND org_id = ${orgId} RETURNING *`);
    return result.rows[0];
  },
  async suppressComplianceFinding(id: string, _details: any, orgId: string) {
    const result = await db.execute(sql`UPDATE compliance_findings SET status = 'suppressed' WHERE id = ${id} AND org_id = ${orgId} RETURNING *`);
    return result.rows[0];
  },
  async deleteComplianceFinding(id: string, orgId: string) {
    await db.execute(sql`DELETE FROM compliance_findings WHERE id = ${id} AND org_id = ${orgId}`);
  },
  async getComplianceRules(orgId: string, filters?: any) {
    const result = await db.execute(sql`SELECT * FROM compliance_rules WHERE org_id = ${orgId} ${filters?.sourceType ? sql`AND source_type = ${filters.sourceType}` : sql``} ${filters?.category ? sql`AND category = ${filters.category}` : sql``} ${filters?.enabled !== undefined ? sql`AND enabled = ${filters.enabled}` : sql``} ORDER BY rule_name ASC`);
    return result.rows;
  },
  async getComplianceRuleById(id: string, orgId: string) {
    const result = await db.execute(sql`SELECT * FROM compliance_rules WHERE id = ${id} AND org_id = ${orgId}`);
    return result.rows[0];
  },
  async createComplianceRule(data: any) {
    const result = await db.execute(sql`INSERT INTO compliance_rules (org_id, source_type, category, rule_name, rule_code, description, severity, enabled) VALUES (${data.orgId}, ${data.sourceType}, ${data.category}, ${data.ruleName}, ${data.ruleCode}, ${data.description}, ${data.severity}, ${data.enabled ?? true}) RETURNING *`);
    return result.rows[0];
  },
  async updateComplianceRule(id: string, updates: any, orgId: string) {
    const result = await db.execute(sql`UPDATE compliance_rules SET rule_name = COALESCE(${updates.ruleName}, rule_name), description = COALESCE(${updates.description}, description), severity = COALESCE(${updates.severity}, severity), enabled = COALESCE(${updates.enabled}, enabled) WHERE id = ${id} AND org_id = ${orgId} RETURNING *`);
    return result.rows[0];
  },
  async deleteComplianceRule(id: string, orgId: string) {
    await db.execute(sql`DELETE FROM compliance_rules WHERE id = ${id} AND org_id = ${orgId}`);
  },
};

interface RateLimiters {
  writeOperationRateLimit: any;
  criticalOperationRateLimit: any;
  generalApiRateLimit: any;
}

export function registerComplianceRoutes(app: Express, rateLimiters?: RateLimiters): void {
  const writeOperationRateLimit = rateLimiters?.writeOperationRateLimit || ((req: any, res: any, next: any) => next());
  const criticalOperationRateLimit = rateLimiters?.criticalOperationRateLimit || ((req: any, res: any, next: any) => next());

  // ===== COMPLIANCE RULES ENGINE ROUTES =====

  app.get("/api/compliance/findings",
    withErrorHandling("get compliance findings", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const filters = {
        vesselId: req.query.vesselId as string | undefined,
        sourceType: req.query.sourceType as string | undefined,
        severity: req.query.severity as string | undefined,
        status: req.query.status as string | undefined,
        ruleCode: req.query.ruleCode as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };
      
      const findings = await complianceRepo.getComplianceFindings(orgId!, filters);
      res.json(findings);
    })
  );

  app.get("/api/compliance/findings/:id",
    withErrorHandling("get compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const finding = await complianceRepo.getComplianceFindingById(req.params.id, orgId!);
      
      if (!finding) {
        return sendNotFound(res, "Compliance finding");
      }
      
      res.json(finding);
    })
  );

  app.post("/api/compliance/findings", writeOperationRateLimit,
    withErrorHandling("create compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const finding = await complianceRepo.createComplianceFinding({
        ...req.body,
        orgId,
      });
      res.status(201).json(finding);
    })
  );

  app.post("/api/compliance/findings/:id/acknowledge", writeOperationRateLimit,
    withErrorHandling("acknowledge compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { acknowledgedByUserId, acknowledgedByUserName } = req.body;
      
      if (!acknowledgedByUserId || !acknowledgedByUserName) {
        return res.status(400).json({ error: "User details required for acknowledgment" });
      }
      
      const finding = await complianceRepo.acknowledgeComplianceFinding(
        req.params.id,
        { acknowledgedByUserId, acknowledgedByUserName },
        orgId
      );
      res.json(finding);
    })
  );

  app.post("/api/compliance/findings/:id/resolve", writeOperationRateLimit,
    withErrorHandling("resolve compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { resolvedByUserId, resolvedByUserName, resolutionNotes } = req.body;
      
      if (!resolvedByUserId || !resolvedByUserName) {
        return res.status(400).json({ error: "User details required for resolution" });
      }
      
      const finding = await complianceRepo.resolveComplianceFinding(
        req.params.id,
        { resolvedByUserId, resolvedByUserName, resolutionNotes },
        orgId
      );
      res.json(finding);
    })
  );

  app.post("/api/compliance/findings/:id/suppress", writeOperationRateLimit,
    withErrorHandling("suppress compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { suppressedUntil, suppressedReason } = req.body;
      
      if (!suppressedUntil || !suppressedReason) {
        return res.status(400).json({ error: "Suppression details required" });
      }
      
      const finding = await complianceRepo.suppressComplianceFinding(
        req.params.id,
        { suppressedUntil: new Date(suppressedUntil), suppressedReason },
        orgId
      );
      res.json(finding);
    })
  );

  app.delete("/api/compliance/findings/:id", criticalOperationRateLimit,
    withErrorHandling("delete compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      await complianceRepo.deleteComplianceFinding(req.params.id, orgId!);
      res.status(204).send();
    })
  );

  app.get("/api/compliance/rules",
    withErrorHandling("get compliance rules", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const filters = {
        sourceType: req.query.sourceType as string | undefined,
        category: req.query.category as string | undefined,
        enabled: req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined,
      };
      
      const rules = await complianceRepo.getComplianceRules(orgId!, filters);
      res.json(rules);
    })
  );

  app.get("/api/compliance/rules/:id",
    withErrorHandling("get compliance rule", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const rule = await complianceRepo.getComplianceRuleById(req.params.id, orgId!);
      
      if (!rule) {
        return sendNotFound(res, "Compliance rule");
      }
      
      res.json(rule);
    })
  );

  app.post("/api/compliance/rules", writeOperationRateLimit,
    withErrorHandling("create compliance rule", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const rule = await complianceRepo.createComplianceRule({
        ...req.body,
        orgId,
      });
      res.status(201).json(rule);
    })
  );

  app.patch("/api/compliance/rules/:id", writeOperationRateLimit,
    withErrorHandling("update compliance rule", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const rule = await complianceRepo.updateComplianceRule(req.params.id, req.body, orgId!);
      res.json(rule);
    })
  );

  app.delete("/api/compliance/rules/:id", criticalOperationRateLimit,
    withErrorHandling("delete compliance rule", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      await complianceRepo.deleteComplianceRule(req.params.id, orgId!);
      res.status(204).send();
    })
  );

  app.post("/api/compliance/check", writeOperationRateLimit,
    withErrorHandling("run compliance check", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, logDate, logType } = req.body;

      if (!vesselId || !logDate || !logType) {
        return res.status(400).json({ error: "vesselId, logDate, and logType are required" });
      }

      if (!["deck", "engine"].includes(logType)) {
        return res.status(400).json({ error: "logType must be 'deck' or 'engine'" });
      }

      const { complianceRulesEngine } = await import("../../services/compliance-rules-engine");
      
      const result = await complianceRulesEngine.runComplianceCheck({
        orgId,
        vesselId,
        logDate,
        logType,
      });

      res.json({
        checked: true,
        vesselId,
        logDate,
        logType,
        newFindingsCount: result.newFindings.length,
        autoResolvedCount: result.autoResolved.length,
        stillOpenCount: result.stillOpen.length,
        newFindings: result.newFindings,
        autoResolved: result.autoResolved,
        stillOpen: result.stillOpen,
      });
    })
  );

  app.post("/api/compliance/rules/seed", writeOperationRateLimit,
    withErrorHandling("seed compliance rules", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { complianceRulesEngine } = await import("../../services/compliance-rules-engine");
      
      await complianceRulesEngine.seedDefaultRules(orgId);
      res.json({ success: true, message: "Default compliance rules seeded" });
    })
  );

  app.get("/api/compliance/summary/:vesselId",
    withErrorHandling("get compliance summary", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId } = req.params;

      const findings = await complianceRepo.getComplianceFindings(orgId!, {
        vesselId,
        status: "open",
      });

      const summary = {
        vesselId,
        totalOpenFindings: findings.length,
        bySeverity: {
          critical: findings.filter((f) => f.severity === "critical").length,
          warning: findings.filter((f) => f.severity === "warning").length,
          info: findings.filter((f) => f.severity === "info").length,
        },
        bySource: {
          logbook_deck: findings.filter((f) => f.sourceType === "logbook_deck").length,
          logbook_engine: findings.filter((f) => f.sourceType === "logbook_engine").length,
          crew: findings.filter((f) => f.sourceType === "crew").length,
          maintenance: findings.filter((f) => f.sourceType === "maintenance").length,
          telemetry: findings.filter((f) => f.sourceType === "telemetry").length,
        },
        byCategory: {
          operational: findings.filter((f) => f.category === "operational").length,
          safety: findings.filter((f) => f.category === "safety").length,
          data_integrity: findings.filter((f) => f.category === "data_integrity").length,
          regulatory: findings.filter((f) => f.category === "regulatory").length,
        },
        recentFindings: findings.slice(0, 10),
      };

      res.json(summary);
    })
  );

  // ===== STCW COMPLIANCE DASHBOARD ROUTES =====

  app.get("/api/dashboard/stcw-summary",
    withErrorHandling("fetch fleet STCW summary", async (req: Request, res: Response) => {
      const orgId = req.orgId!;
      const { days = "30" } = req.query;
      const lookbackDays = Number.parseInt(days as string, 10) || 30;

      const { getFleetSTCWSummary } = await import("../../scheduler/stcw-dashboard");
      const summary = await getFleetSTCWSummary(orgId, lookbackDays);

      res.setHeader("Cache-Control", "private, max-age=300");
      res.json(summary);
    })
  );

  app.get("/api/dashboard/stcw-summary/vessel/:vesselId",
    withErrorHandling("fetch vessel STCW summary", async (req: Request, res: Response) => {
      const orgId = req.orgId!;
      const { vesselId } = req.params;
      const { days = "30" } = req.query;
      const lookbackDays = Number.parseInt(days as string, 10) || 30;

      const { getVesselSTCWSummary } = await import("../../scheduler/stcw-dashboard");
      const summary = await getVesselSTCWSummary(orgId, vesselId, lookbackDays);

      res.setHeader("Cache-Control", "private, max-age=300");
      res.json(summary);
    })
  );

  app.get("/api/dashboard/stcw-trends",
    withErrorHandling("fetch STCW trends", async (req: Request, res: Response) => {
      const orgId = req.orgId!;
      const { days = "30", vesselId } = req.query;
      const lookbackDays = Number.parseInt(days as string, 10) || 30;

      const { getSTCWComplianceTrends } = await import("../../scheduler/stcw-dashboard");
      const trends = await getSTCWComplianceTrends(orgId, lookbackDays, vesselId as string | undefined);

      res.setHeader("Cache-Control", "private, max-age=300");
      res.json(trends);
    })
  );

  logger.info("ComplianceRoutes", "Registered (findings: 7, rules: 6, dashboard: 3)");
}
