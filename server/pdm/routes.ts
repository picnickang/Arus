import { Router } from 'express';
import { z } from 'zod';
import { pdmPostgresRepository } from './adapters/pdm-postgres.repository';
import { createGetDashboardUseCase } from './application/get-dashboard.use-case';
import { createGetRiskQueueUseCase } from './application/get-risk-queue.use-case';
import { createGetAssetDetailUseCase } from './application/get-asset-detail.use-case';
import { createAcknowledgeRiskUseCase } from './application/acknowledge-risk.use-case';
import { createCreateWorkOrderFromRiskUseCase } from './application/create-work-order.use-case';
import { createGetScheduleUseCase } from './application/get-schedule.use-case';
import { DEFAULT_ORG_ID } from '@shared/config/tenant';
import type { RiskQueueItem } from './domain/types';
import { DatabaseTelemetryStorage } from '../db/telemetry/db-telemetry';

const router = Router();

const getDashboardUseCase = createGetDashboardUseCase(pdmPostgresRepository);
const getRiskQueueUseCase = createGetRiskQueueUseCase(pdmPostgresRepository);
const getAssetDetailUseCase = createGetAssetDetailUseCase(pdmPostgresRepository);
const acknowledgeRiskUseCase = createAcknowledgeRiskUseCase(pdmPostgresRepository);
const createWorkOrderFromRiskUseCase = createCreateWorkOrderFromRiskUseCase(pdmPostgresRepository);
const getScheduleUseCase = createGetScheduleUseCase(pdmPostgresRepository);
const telemetryStorage = new DatabaseTelemetryStorage();

const riskStatusSchema = z.enum(['new', 'active', 'resolved']);

const dashboardFiltersSchema = z.object({
  vesselId: z.string().optional(),
  equipmentType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
});

function filterRiskQueue(items: RiskQueueItem[], filters: z.infer<typeof dashboardFiltersSchema>): RiskQueueItem[] {
  return items.filter(item => {
    if (filters.vesselId && item.vesselId !== filters.vesselId) return false;
    if (filters.equipmentType && item.equipmentType !== filters.equipmentType) return false;
    if (filters.dateFrom) {
      const detectedDate = new Date(item.detectedAt);
      if (detectedDate < new Date(filters.dateFrom)) return false;
    }
    if (filters.dateTo) {
      const detectedDate = new Date(item.detectedAt);
      if (detectedDate > new Date(filters.dateTo)) return false;
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesName = item.equipmentName.toLowerCase().includes(searchLower);
      const matchesVessel = item.vesselName.toLowerCase().includes(searchLower);
      const matchesFailureMode = item.failureMode.toLowerCase().includes(searchLower);
      if (!matchesName && !matchesVessel && !matchesFailureMode) return false;
    }
    return true;
  });
}

function formatCsvRow(values: (string | number | null | undefined)[]): string {
  return values.map(v => {
    if (v === null || v === undefined) return '';
    const str = String(v);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(',');
}

router.get('/dashboard', async (req, res) => {
  try {
    const orgId = req.headers['x-org-id'] as string || DEFAULT_ORG_ID;
    const filters = dashboardFiltersSchema.parse(req.query);
    
    const dashboardData = await getDashboardUseCase.execute({ orgId });
    
    if (filters.vesselId || filters.equipmentType || filters.dateFrom || filters.dateTo || filters.search) {
      dashboardData.riskQueue.new = filterRiskQueue(dashboardData.riskQueue.new, filters);
      dashboardData.riskQueue.active = filterRiskQueue(dashboardData.riskQueue.active, filters);
      dashboardData.riskQueue.resolved = filterRiskQueue(dashboardData.riskQueue.resolved, filters);
    }
    
    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching PdM dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

router.get('/filter-options', async (req, res) => {
  try {
    const orgId = req.headers['x-org-id'] as string || DEFAULT_ORG_ID;
    
    const [vessels, equipmentTypes] = await Promise.all([
      pdmPostgresRepository.getVessels(orgId),
      pdmPostgresRepository.getEquipmentTypes(orgId),
    ]);
    
    res.json({ vessels, equipmentTypes });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({ error: 'Failed to fetch filter options' });
  }
});

router.get('/risk-queue/:status', async (req, res) => {
  try {
    const orgId = req.headers['x-org-id'] as string || DEFAULT_ORG_ID;
    const statusResult = riskStatusSchema.safeParse(req.params.status);
    if (!statusResult.success) {
      return res.status(400).json({ error: 'Invalid status. Must be new, active, or resolved.' });
    }
    const items = await getRiskQueueUseCase.execute({ orgId, status: statusResult.data });
    res.json(items);
  } catch (error) {
    console.error('Error fetching risk queue:', error);
    res.status(500).json({ error: 'Failed to fetch risk queue' });
  }
});

router.get('/asset/:equipmentId', async (req, res) => {
  try {
    const orgId = req.headers['x-org-id'] as string || DEFAULT_ORG_ID;
    const equipmentId = req.params.equipmentId;
    if (!equipmentId) {
      return res.status(400).json({ error: 'Equipment ID is required' });
    }
    const assetDetail = await getAssetDetailUseCase.execute({ orgId, equipmentId });
    if (!assetDetail) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(assetDetail);
  } catch (error) {
    console.error('Error fetching asset detail:', error);
    res.status(500).json({ error: 'Failed to fetch asset detail' });
  }
});

router.post('/risk/:itemId/acknowledge', async (req, res) => {
  try {
    const orgId = req.headers['x-org-id'] as string || DEFAULT_ORG_ID;
    const userId = req.headers['x-user-id'] as string || 'system';
    const itemId = req.params.itemId;
    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }
    await acknowledgeRiskUseCase.execute({ orgId, itemId, userId });
    res.json({ success: true });
  } catch (error) {
    console.error('Error acknowledging risk item:', error);
    res.status(500).json({ error: 'Failed to acknowledge risk item' });
  }
});

router.post('/risk/:itemId/create-work-order', async (req, res) => {
  try {
    const orgId = req.headers['x-org-id'] as string || DEFAULT_ORG_ID;
    const userId = req.headers['x-user-id'] as string || 'system';
    const itemId = req.params.itemId;
    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }
    const result = await createWorkOrderFromRiskUseCase.execute({ orgId, itemId, userId });
    res.json({ success: true, workOrderId: result.workOrderId });
  } catch (error) {
    console.error('Error creating work order from risk:', error);
    res.status(500).json({ error: 'Failed to create work order' });
  }
});

const scheduleFiltersSchema = z.object({
  vesselIds: z.string().optional(),
  equipmentTypes: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  maxTasksPerVesselPerDay: z.coerce.number().min(1).max(10).optional(),
  autoPopulate: z.enum(['true', 'false']).optional().transform(v => v !== 'false'),
});

router.get('/schedule', async (req, res) => {
  try {
    const orgId = req.headers['x-org-id'] as string || DEFAULT_ORG_ID;
    const filters = scheduleFiltersSchema.parse(req.query);
    
    const result = await getScheduleUseCase.execute({
      orgId,
      vesselIds: filters.vesselIds ? filters.vesselIds.split(',') : undefined,
      equipmentTypes: filters.equipmentTypes ? filters.equipmentTypes.split(',') : undefined,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      maxTasksPerVesselPerDay: filters.maxTasksPerVesselPerDay,
      autoPopulate: filters.autoPopulate,
    });
    
    res.json(result.data);
  } catch (error) {
    console.error('Error fetching PdM schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

router.get('/export/schedule', async (req, res) => {
  try {
    const orgId = req.headers['x-org-id'] as string || DEFAULT_ORG_ID;
    const format = (req.query.format as string) || 'csv';
    const filters = scheduleFiltersSchema.parse(req.query);
    
    const result = await getScheduleUseCase.execute({
      orgId,
      vesselIds: filters.vesselIds ? filters.vesselIds.split(',') : undefined,
      equipmentTypes: filters.equipmentTypes ? filters.equipmentTypes.split(',') : undefined,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    });
    
    const allTasks = [...result.data.scheduledTasks, ...result.data.blockedTasks];
    
    if (format === 'csv') {
      const headers = [
        'Task ID', 'Alert ID', 'Vessel', 'Equipment', 'Type', 'Failure Mode', 
        'Severity', 'RUL P10', 'RUL P50', 'RUL P90', 'Confidence %', 
        'Earliest Start', 'Preferred Date', 'Latest Finish', 'Scheduled Date',
        'Status', 'Block Reason', 'Block Details', 'Est. Downtime (hrs)', 
        'Est. Cost', 'Recommended Actions', 'Work Order ID'
      ];
      const rows = allTasks.map(task => formatCsvRow([
        task.id,
        task.alertId,
        task.vesselName,
        task.equipmentName,
        task.equipmentType,
        task.failureMode,
        task.severity,
        task.rulP10Days,
        task.rulP50Days,
        task.rulP90Days,
        task.confidence,
        task.schedulingWindow.earliestStart.toISOString().split('T')[0],
        task.schedulingWindow.preferredDate.toISOString().split('T')[0],
        task.schedulingWindow.latestFinish.toISOString().split('T')[0],
        task.scheduledDate ? new Date(task.scheduledDate).toISOString().split('T')[0] : '',
        task.status,
        task.blockReason || '',
        task.blockDetails || '',
        task.estimatedDowntimeHours,
        task.estimatedCost,
        task.recommendedActions.join('; '),
        task.workOrderId || '',
      ]));
      
      const csv = [headers.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=pdm-schedule-export.csv');
      res.send(csv);
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=pdm-schedule-export.json');
      res.json(allTasks);
    } else {
      res.status(400).json({ error: 'Invalid format. Supported: csv, json' });
    }
  } catch (error) {
    console.error('Error exporting schedule:', error);
    res.status(500).json({ error: 'Failed to export schedule' });
  }
});

router.get('/export/risk-queue', async (req, res) => {
  try {
    const orgId = req.headers['x-org-id'] as string || DEFAULT_ORG_ID;
    const format = (req.query.format as string) || 'csv';
    const filters = dashboardFiltersSchema.parse(req.query);
    
    const dashboardData = await getDashboardUseCase.execute({ orgId });
    let allItems = [
      ...dashboardData.riskQueue.new,
      ...dashboardData.riskQueue.active,
      ...dashboardData.riskQueue.resolved,
    ];
    
    if (filters.vesselId || filters.equipmentType || filters.dateFrom || filters.dateTo || filters.search) {
      allItems = filterRiskQueue(allItems, filters);
    }
    
    if (format === 'csv') {
      const headers = ['ID', 'Vessel', 'Equipment', 'Type', 'Failure Mode', 'Severity', 'RUL (Days)', 'Confidence %', 'Status', 'Detected At', 'Recommended Action'];
      const rows = allItems.map(item => formatCsvRow([
        item.id,
        item.vesselName,
        item.equipmentName,
        item.equipmentType,
        item.failureMode,
        item.severity,
        item.rulEstimateDays,
        item.confidence,
        item.status,
        new Date(item.detectedAt).toISOString(),
        item.recommendedAction,
      ]));
      
      const csv = [headers.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=risk-queue-export.csv');
      res.send(csv);
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=risk-queue-export.json');
      res.json(allItems);
    } else {
      res.status(400).json({ error: 'Invalid format. Supported: csv, json' });
    }
  } catch (error) {
    console.error('Error exporting risk queue:', error);
    res.status(500).json({ error: 'Failed to export risk queue' });
  }
});

router.get('/export/kpis', async (req, res) => {
  try {
    const orgId = req.headers['x-org-id'] as string || DEFAULT_ORG_ID;
    const format = (req.query.format as string) || 'json';
    
    const dashboardData = await getDashboardUseCase.execute({ orgId });
    const kpis = dashboardData.kpis;
    
    if (format === 'csv') {
      const headers = ['Metric', 'Value', 'Period/Change'];
      const rows = [
        formatCsvRow(['Fleet Health Score', kpis.fleetHealthScore, `${kpis.fleetHealthChange > 0 ? '+' : ''}${kpis.fleetHealthChange}% ${kpis.fleetHealthPeriod}`]),
        formatCsvRow(['Active Alerts', kpis.activeAlertsTotal, `${kpis.criticalAlertsCount} critical`]),
        formatCsvRow(['Assets at Risk', kpis.assetsAtRisk, `${kpis.assetsRulUnder14Days} under 14 days`]),
        formatCsvRow(['Avoided Downtime (hrs)', kpis.avoidedDowntimeHours, kpis.avoidedDowntimePeriod]),
        formatCsvRow(['Maintenance Forecast', `$${kpis.maintenanceForecastCost.toLocaleString()}`, kpis.maintenanceForecastPeriod]),
      ];
      
      const csv = [headers.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=kpis-export.csv');
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=kpis-export.json');
      res.json(kpis);
    }
  } catch (error) {
    console.error('Error exporting KPIs:', error);
    res.status(500).json({ error: 'Failed to export KPIs' });
  }
});

router.get('/equipment/:equipmentId/telemetry', async (req, res) => {
  try {
    const equipmentId = req.params.equipmentId;
    const limit = parseInt(req.query.limit as string) || 50;
    const sensorType = req.query.sensorType as string;
    const hours = parseInt(req.query.hours as string) || 24;
    
    if (!equipmentId) {
      return res.status(400).json({ error: 'Equipment ID is required' });
    }
    
    let readings;
    if (sensorType) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hours);
      readings = await telemetryStorage.getTelemetryByEquipmentAndDateRange(
        equipmentId, startDate, endDate, sensorType
      );
    } else {
      readings = await telemetryStorage.getLatestTelemetryReadings(equipmentId, limit);
    }
    
    const formatted = readings.map(r => ({
      ts: r.ts,
      sensorType: r.sensorType,
      value: r.value,
      unit: r.unit,
      status: r.status,
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching equipment telemetry:', error);
    res.status(500).json({ error: 'Failed to fetch telemetry data' });
  }
});

router.get('/telemetry/trends', async (req, res) => {
  try {
    const equipmentId = req.query.equipmentId as string;
    const hours = parseInt(req.query.hours as string) || 24;
    
    const trends = await telemetryStorage.getTelemetryTrends(equipmentId, hours);
    res.json(trends);
  } catch (error) {
    console.error('Error fetching telemetry trends:', error);
    res.status(500).json({ error: 'Failed to fetch telemetry trends' });
  }
});

export { router as pdmRouter };
