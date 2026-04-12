/**
 * Compliance Excel - Fleet Compliance Overview Report Generation
 */

import type { EquipmentHealth, WorkOrder } from '@shared/schema-runtime';
import type { IStorage } from '../repositories.js';
import type { ReportingPeriod } from './types';
import {
  createWorkbook,
  addSheet,
  writeWorkbook,
  formatDate,
  countByStatus,
  getComplianceStatus,
  buildStandardsSheet,
} from './utils';

export async function generateFleetComplianceOverviewExcel(
  storage: IStorage,
  orgId: string,
  period: ReportingPeriod
): Promise<Buffer> {
  console.log(`[Compliance Excel] Generating fleet compliance overview for org: ${orgId}`);

  const equipmentHealth = await storage.getEquipmentHealth(orgId);
  const workOrders = await storage.getWorkOrders(undefined, orgId);

  return renderFleetOverviewExcel(equipmentHealth, workOrders, period);
}

function renderFleetOverviewExcel(
  equipment: EquipmentHealth[],
  workOrders: WorkOrder[],
  period: ReportingPeriod
): Buffer {
  const workbook = createWorkbook();
  const counts = countByStatus(equipment);
  const complianceRate =
    equipment.length > 0 ? ((counts.healthy / equipment.length) * 100).toFixed(1) : 'N/A';

  const summaryData: any[][] = [
    ['FLEET COMPLIANCE OVERVIEW'],
    [],
    ['Report Details'],
    ['Generated', new Date().toISOString()],
    ['Report Type', 'FLEET AUDIT'],
    [],
    ['Period'],
    ['Start Date', formatDate(period.startDate)],
    ['End Date', formatDate(period.endDate)],
    [],
    ['Fleet Statistics'],
    ['Total Equipment', equipment.length],
    ['Healthy (Compliant)', counts.healthy],
    ['Warning (Review Required)', counts.warning],
    ['Critical (Non-Compliant)', counts.critical],
    ['Compliance Rate (%)', complianceRate],
    [],
    ['Work Order Statistics'],
    ['Total Work Orders', workOrders.length],
    ['Completed', workOrders.filter((wo) => wo.status === 'completed').length],
    ['Open', workOrders.filter((wo) => wo.status === 'open').length],
    ['In Progress', workOrders.filter((wo) => wo.status === 'in_progress').length],
  ];

  addSheet(workbook, summaryData, 'Summary');

  const equipmentData: any[][] = [
    ['FLEET EQUIPMENT STATUS'],
    [],
    ['ID', 'Name', 'Type', 'Vessel', 'Status', 'Health Index', 'Risk Score', 'Compliance Status'],
  ];

  for (const eq of equipment) {
    equipmentData.push([
      eq.id,
      eq.name ?? '',
      eq.type ?? '',
      eq.vessel ?? '',
      eq.status ?? '',
      eq.healthIndex ?? 0,
      eq.riskScore ?? 0,
      getComplianceStatus(eq.status),
    ]);
  }

  addSheet(workbook, equipmentData, 'Equipment');

  const woData: any[][] = [
    ['FLEET MAINTENANCE OVERVIEW'],
    [],
    [
      'WO Number',
      'Equipment',
      'Vessel',
      'Type',
      'Priority',
      'Status',
      'Created',
      'Scheduled Start',
      'Description',
    ],
  ];

  for (const wo of workOrders) {
    woData.push([
      wo.workOrderNumber ?? wo.id,
      wo.equipmentId ?? '',
      wo.vesselId ?? '',
      wo.maintenanceType ?? '',
      wo.priority ?? '',
      wo.status ?? '',
      formatDate(wo.createdAt),
      formatDate(wo.plannedStartDate),
      wo.description ?? '',
    ]);
  }

  addSheet(workbook, woData, 'Maintenance');
  addSheet(workbook, buildStandardsSheet(), 'Standards');

  return writeWorkbook(workbook);
}
