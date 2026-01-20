import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { auditService } from '../immutable-audit.service';
import { requireAdminAuth, auditAdminAction } from '../../security';
import { storage } from '../../storage';
import { requireComplianceAccess } from './audit-routes';
import { recordEngineerOverride, recordOverrideOutcome, getEngineerOverrides as getProvenanceOverrides } from '../../governance/provenance';
import { insertEngineerOverrideSchema } from '@shared/schema';

const router = Router();

const engineerOverrideSchema = insertEngineerOverrideSchema.extend({
  justification: z.string().min(10, 'Justification must be at least 10 characters'),
  overrideType: z.enum(['defer', 'escalate', 'dismiss', 'modify']),
  originalRiskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  newRiskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  engineerId: z.string().min(1, 'Engineer ID is required'),
  engineerName: z.string().min(1, 'Engineer name is required'),
  originalPrediction: z.record(z.unknown()),
});

const updateOutcomeSchema = z.object({
  outcomeStatus: z.enum(['pending', 'validated', 'failure_prevented', 'failure_occurred']),
  outcomeNotes: z.string().max(1000, 'Outcome notes must be less than 1000 characters').optional(),
});

router.get('/ml-governance/overrides', requireAdminAuth, requireComplianceAccess, async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) { return res.status(401).json({ error: 'Organization ID required' }); }
    const { equipmentId, engineerId, overrideType, outcomeStatus, fromDate, toDate } = req.query;
    const overrides = await storage.getEngineerOverrides(orgId, { equipmentId: equipmentId as string, engineerId: engineerId as string, overrideType: overrideType as string, outcomeStatus: outcomeStatus as string, fromDate: fromDate ? new Date(fromDate as string) : undefined, toDate: toDate ? new Date(toDate as string) : undefined });
    res.json({ success: true, data: overrides, count: overrides.length });
  } catch (error) {
    console.error('[Compliance] Get engineer overrides error:', error);
    res.status(500).json({ error: 'Failed to retrieve engineer overrides' });
  }
});

router.get('/ml-governance/overrides/:id', requireAdminAuth, requireComplianceAccess, async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const { id } = req.params;
    if (!orgId) { return res.status(401).json({ error: 'Organization ID required' }); }
    const override = await storage.getEngineerOverride(id, orgId);
    if (!override) { return res.status(404).json({ error: 'Engineer override not found' }); }
    res.json({ success: true, data: override });
  } catch (error) {
    console.error('[Compliance] Get engineer override error:', error);
    res.status(500).json({ error: 'Failed to retrieve engineer override' });
  }
});

router.post('/ml-governance/overrides', requireAdminAuth, auditAdminAction('engineer_override_create'), async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) { return res.status(401).json({ error: 'Organization ID required' }); }
    const validatedData = engineerOverrideSchema.parse({ ...req.body, orgId });
    const override = await storage.createEngineerOverride(validatedData, orgId);
    await recordEngineerOverride({ overrideId: override.id, predictionId: override.predictionId || undefined, equipmentId: override.equipmentId, vesselId: undefined, workOrderId: override.workOrderId || undefined, overrideType: override.overrideType as 'defer' | 'escalate' | 'dismiss' | 'modify', originalRiskLevel: override.originalRiskLevel, newRiskLevel: override.newRiskLevel || undefined, originalConfidence: override.originalConfidence || undefined, justification: override.justification, engineerId: override.engineerId, engineerName: override.engineerName, engineerCertifications: override.engineerCertifications || undefined, originalPrediction: override.originalPrediction as Record<string, unknown>, orgId });
    await auditService.logEvent({ orgId, eventCategory: 'ml_prediction', eventType: 'engineer_override_created', entityType: 'engineer_override', entityId: override.id, newState: { equipmentId: override.equipmentId, overrideType: override.overrideType, originalRiskLevel: override.originalRiskLevel, newRiskLevel: override.newRiskLevel, engineerId: override.engineerId, engineerName: override.engineerName }, performedBy: override.engineerId, performedByType: 'user', retentionRequired: true });
    res.status(201).json({ success: true, data: override, message: 'Engineer override recorded and logged to provenance chain' });
  } catch (_error) {
    if (error instanceof z.ZodError) { return res.status(400).json({ error: 'Validation failed', details: error.errors }); }
    console.error('[Compliance] Create engineer override error:', error);
    res.status(500).json({ error: 'Failed to create engineer override' });
  }
});

router.patch('/ml-governance/overrides/:id/outcome', requireAdminAuth, auditAdminAction('engineer_override_outcome'), async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const { id } = req.params;
    if (!orgId) { return res.status(401).json({ error: 'Organization ID required' }); }
    const existingOverride = await storage.getEngineerOverride(id, orgId);
    if (!existingOverride) { return res.status(404).json({ error: 'Engineer override not found' }); }
    const validatedData = updateOutcomeSchema.parse(req.body);
    const outcomeRecordedBy = (req as any).adminId || 'admin';
    const override = await storage.updateEngineerOverrideOutcome(id, { ...validatedData, outcomeRecordedBy }, orgId);
    await recordOverrideOutcome({ overrideId: id, equipmentId: existingOverride.equipmentId, vesselId: undefined, originalOverrideType: existingOverride.overrideType as 'defer' | 'escalate' | 'dismiss' | 'modify', outcomeStatus: validatedData.outcomeStatus as 'pending' | 'validated' | 'failure_prevented' | 'failure_occurred', outcomeNotes: validatedData.outcomeNotes, outcomeRecordedBy, engineerId: existingOverride.engineerId, engineerName: existingOverride.engineerName, orgId });
    await auditService.logEvent({ orgId, eventCategory: 'ml_prediction', eventType: 'engineer_override_outcome_updated', entityType: 'engineer_override', entityId: id, previousState: { outcomeStatus: existingOverride.outcomeStatus }, newState: { outcomeStatus: validatedData.outcomeStatus, outcomeNotes: validatedData.outcomeNotes }, performedBy: outcomeRecordedBy, performedByType: 'user', retentionRequired: true });
    res.json({ success: true, data: override, message: 'Engineer override outcome updated and logged to provenance chain' });
  } catch (_error) {
    if (error instanceof z.ZodError) { return res.status(400).json({ error: 'Validation failed', details: error.errors }); }
    console.error('[Compliance] Update engineer override outcome error:', error);
    res.status(500).json({ error: 'Failed to update engineer override outcome' });
  }
});

router.get('/ml-governance/provenance', requireAdminAuth, requireComplianceAccess, async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) { return res.status(401).json({ error: 'Organization ID required' }); }
    const { equipmentId, engineerId, fromDate, toDate, limit } = req.query;
    const overrides = await getProvenanceOverrides({ orgId, equipmentId: equipmentId as string, engineerId: engineerId as string, fromDate: fromDate ? new Date(fromDate as string) : undefined, toDate: toDate ? new Date(toDate as string) : undefined, limit: limit ? Number.parseInt(limit as string) : 100 });
    res.json({ success: true, data: overrides, count: overrides.length });
  } catch (error) {
    console.error('[Compliance] Get provenance overrides error:', error);
    res.status(500).json({ error: 'Failed to retrieve provenance records' });
  }
});

router.get('/ml-governance/statistics', requireAdminAuth, requireComplianceAccess, async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) { return res.status(401).json({ error: 'Organization ID required' }); }
    const overrides = await storage.getEngineerOverrides(orgId, {});
    const stats = { total: overrides.length, byType: {} as Record<string, number>, byOutcome: {} as Record<string, number>, byRiskLevel: {} as Record<string, number>, avgResponseTime: 0 };
    for (const o of overrides) {
      stats.byType[o.overrideType] = (stats.byType[o.overrideType] ?? 0) + 1;
      if (o.outcomeStatus) { stats.byOutcome[o.outcomeStatus] = (stats.byOutcome[o.outcomeStatus] ?? 0) + 1; }
      stats.byRiskLevel[o.originalRiskLevel] = (stats.byRiskLevel[o.originalRiskLevel] ?? 0) + 1;
    }
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[Compliance] ML governance statistics error:', error);
    res.status(500).json({ error: 'Failed to retrieve ML governance statistics' });
  }
});

export { router as complianceMlGovernanceRouter };
