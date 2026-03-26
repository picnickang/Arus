import type { Express } from 'express';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { actionableInsights, equipment } from '@shared/schema-runtime';
import { InsightEngine } from '../core/insights/insightEngine';
import { logger } from '../utils/logger.js';

const acknowledgeInsightSchema = z.object({
  orgId: z.string().optional().default("default-org"),
  acknowledgedBy: z.string(),
});

const resolveInsightSchema = z.object({
  orgId: z.string().optional().default("default-org"),
  resolvedBy: z.string(),
  resolutionNotes: z.string().optional(),
  workOrderId: z.string().optional(),
});

export function registerInsightsRoutes(app: Express) {
  app.get('/api/insights', async (req, res) => {
    try {
      const orgId = req.headers["x-org-id"] as string;
      if (!orgId) {
        return res.status(400).json({ error: "Organization ID (x-org-id header) is required" });
      }
      const { vesselId, equipmentId, severity, resolved, acknowledged } = req.query;

      let query = db
        .select({
          insight: actionableInsights,
          equipment: {
            id: equipment.id,
            name: equipment.name,
            type: equipment.type,
            vesselId: equipment.vesselId,
          },
        })
        .from(actionableInsights)
        .leftJoin(equipment, eq(actionableInsights.equipmentId, equipment.id))
        .$dynamic()
        .where(eq(actionableInsights.orgId, orgId));

      if (vesselId) {
        query = query.where(eq(actionableInsights.vesselId, vesselId as string));
      }

      if (equipmentId) {
        query = query.where(eq(actionableInsights.equipmentId, equipmentId as string));
      }

      if (severity) {
        query = query.where(eq(actionableInsights.severity, severity as string));
      }

      if (resolved !== undefined) {
        query = query.where(eq(actionableInsights.resolved, resolved === 'true'));
      }

      if (acknowledged !== undefined) {
        query = query.where(eq(actionableInsights.acknowledged, acknowledged === 'true'));
      }

      const results = await query.orderBy(sql`${actionableInsights.createdAt} DESC`);

      const insights = results.map((r) => ({
        ...r.insight,
        equipment: r.equipment,
        supportingSignals: r.insight.supportingSignals
          ? JSON.parse(r.insight.supportingSignals)
          : null,
        relatedProcedures: r.insight.relatedProcedures
          ? JSON.parse(r.insight.relatedProcedures)
          : null,
      }));

      res.json(insights);
    } catch (error) {
      logger.error('Failed to fetch insights', { error });
      res.status(500).json({ error: 'Failed to fetch insights' });
    }
  });

  // Note: These specific routes MUST be registered BEFORE the /:id catch-all route
  // to prevent "snapshots" from being treated as an ID parameter
  app.get('/api/insights/snapshots', async (req, res) => {
    try {
      const orgId = req.headers["x-org-id"] as string;
      if (!orgId) {
        return res.status(400).json({ error: "Organization ID (x-org-id header) is required" });
      }
      const { scope } = req.query;
      const { insightSnapshots } = await import('@shared/schema-runtime');
      let query = db.select().from(insightSnapshots).$dynamic()
        .where(eq(insightSnapshots.orgId, orgId));
      if (scope) {
        query = query.where(eq(insightSnapshots.scope, scope as string));
      }
      const snapshots = await query.orderBy(sql`${insightSnapshots.createdAt} DESC`).limit(100);
      res.json(snapshots);
    } catch (error) {
      logger.error('Failed to fetch insight snapshots', { error });
      res.status(500).json({ error: 'Failed to fetch insight snapshots' });
    }
  });

  app.get('/api/insights/snapshots/latest', async (req, res) => {
    try {
      const { scope = 'fleet' } = req.query;
      // Query database directly
      const { insightSnapshots } = await import('@shared/schema-runtime');
      const [snapshot] = await db.select().from(insightSnapshots)
        .where(eq(insightSnapshots.scope, scope as string))
        .orderBy(sql`${insightSnapshots.createdAt} DESC`)
        .limit(1);
      // Return null if no snapshot found - frontend handles empty state
      res.json(snapshot || null);
    } catch (error) {
      logger.error('Failed to fetch latest insight snapshot', { error });
      res.status(500).json({ error: 'Failed to fetch latest insight snapshot' });
    }
  });

  app.get('/api/insights/:id', async (req, res) => {
    try {
      const orgId = req.headers["x-org-id"] as string;
      if (!orgId) {
        return res.status(400).json({ error: "Organization ID (x-org-id header) is required" });
      }
      const { id } = req.params;

      const conditions = [eq(actionableInsights.id, id), eq(actionableInsights.orgId, orgId)];

      const [result] = await db
        .select({
          insight: actionableInsights,
          equipment: {
            id: equipment.id,
            name: equipment.name,
            type: equipment.type,
            vesselId: equipment.vesselId,
          },
        })
        .from(actionableInsights)
        .leftJoin(equipment, eq(actionableInsights.equipmentId, equipment.id))
        .where(and(...conditions))
        .limit(1);

      if (!result) {
        return res.status(403).json({ error: 'Insight not found or access denied' });
      }

      const insight = {
        ...result.insight,
        equipment: result.equipment,
        supportingSignals: result.insight.supportingSignals
          ? JSON.parse(result.insight.supportingSignals)
          : null,
        relatedProcedures: result.insight.relatedProcedures
          ? JSON.parse(result.insight.relatedProcedures)
          : null,
      };

      res.json(insight);
    } catch (error) {
      logger.error('Failed to fetch insight', { error });
      res.status(500).json({ error: 'Failed to fetch insight' });
    }
  });

  app.post('/api/insights/evaluate/:equipmentId', async (req, res) => {
    try {
      const { equipmentId } = req.params;
      const { vesselId } = req.body;
      const orgId = req.body.orgId || (req.headers["x-org-id"] as string);
      if (!orgId) {
        return res.status(400).json({ error: "Organization ID (x-org-id header) is required" });
      }

      // Verify equipment exists
      const [equipmentRecord] = await db
        .select()
        .from(equipment)
        .where(eq(equipment.id, equipmentId))
        .limit(1);

      if (!equipmentRecord) {
        return res.status(404).json({ error: 'Equipment not found' });
      }

      const insightIds = await InsightEngine.evaluateAndStoreInsights(
        equipmentId,
        orgId,
        vesselId
      );

      res.json({
        success: true,
        equipmentId,
        insightsCreated: insightIds.length,
        insightIds,
      });
    } catch (error) {
      logger.error('Failed to evaluate equipment', { error });
      res.status(500).json({ error: 'Failed to evaluate equipment' });
    }
  });

  app.patch('/api/insights/:id/acknowledge', async (req, res) => {
    try {
      const { id } = req.params;
      const body = acknowledgeInsightSchema.parse(req.body);

      const [updated] = await db
        .update(actionableInsights)
        .set({
          acknowledged: true,
          acknowledgedAt: new Date(),
          acknowledgedBy: body.acknowledgedBy,
        })
        .where(eq(actionableInsights.id, id))
        .returning();

      if (!updated) {
        return res.status(403).json({ error: 'Insight not found or access denied' });
      }

      res.json(updated);
    } catch (error) {
      logger.error('Failed to acknowledge insight', { error });
      res.status(500).json({ error: 'Failed to acknowledge insight' });
    }
  });

  app.patch('/api/insights/:id/resolve', async (req, res) => {
    try {
      const { id } = req.params;
      const body = resolveInsightSchema.parse(req.body);

      const [updated] = await db
        .update(actionableInsights)
        .set({
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: body.resolvedBy,
          resolutionNotes: body.resolutionNotes || null,
          workOrderId: body.workOrderId || null,
        })
        .where(eq(actionableInsights.id, id))
        .returning();

      if (!updated) {
        return res.status(403).json({ error: 'Insight not found or access denied' });
      }

      res.json(updated);
    } catch (error) {
      logger.error('Failed to resolve insight', { error });
      res.status(500).json({ error: 'Failed to resolve insight' });
    }
  });

  app.get('/api/insights/stats/summary', async (req, res) => {
    try {
      const { vesselId } = req.query;

      let baseQuery = db
        .select({
          severity: actionableInsights.severity,
          resolved: actionableInsights.resolved,
          count: sql<number>`count(*)`.as('count'),
        })
        .from(actionableInsights)
        .$dynamic();

      if (vesselId) {
        baseQuery = baseQuery.where(eq(actionableInsights.vesselId, vesselId as string));
      }

      const stats = await baseQuery
        .groupBy(actionableInsights.severity, actionableInsights.resolved);

      const summary = {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        resolved: 0,
        unresolved: 0,
      };

      stats.forEach((stat) => {
        const count = Number(stat.count);
        summary.total += count;

        if (stat.severity === 'critical') {
          summary.critical += count;
        }

        if (stat.severity === 'high') {
          summary.high += count;
        }

        if (stat.severity === 'medium') {
          summary.medium += count;
        }

        if (stat.severity === 'low') {
          summary.low += count;
        }

        if (stat.resolved) {
          summary.resolved += count;
        } else {
          summary.unresolved += count;
        }
      });

      res.json(summary);
    } catch (error) {
      logger.error('Failed to fetch insight stats', { error });
      res.status(500).json({ error: 'Failed to fetch insight stats' });
    }
  });

  logger.info('Actionable Insights API routes registered');
}
