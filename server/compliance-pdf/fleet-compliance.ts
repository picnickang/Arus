/**
 * Compliance PDF - Fleet Compliance Overview Report Generation
 */

import type { WorkOrder } from "@shared/schema";
import type { EquipmentHealth } from "../db/equipment/types.js";

import { MARITIME_STANDARDS } from '../compliance.js';
import type { ComplianceDeps, ReportingPeriod } from './types';
import {
  createPDFContext,
  formatDate,
  countByStatus,
  getComplianceColor,
  drawTitle,
  drawSectionHeader,
  drawText,
  addSpacing,
  COLORS,
} from './utils';

export async function generateFleetComplianceOverviewPDF(
  storage: ComplianceDeps,
  orgId: string,
  period: ReportingPeriod
): Promise<Uint8Array> {
  console.log(`[Compliance PDF] Generating fleet compliance overview for org: ${orgId}`);

  const equipmentHealth = await storage.getEquipmentHealth(orgId);
  const workOrders = await storage.getWorkOrders(undefined, orgId);

  return renderFleetOverviewPDF(equipmentHealth, workOrders, period);
}

async function renderFleetOverviewPDF(
  equipment: EquipmentHealth[],
  workOrders: WorkOrder[],
  period: ReportingPeriod
): Promise<Uint8Array> {
  const ctx = await createPDFContext();
  const counts = countByStatus(equipment);
  const complianceRate =
    equipment.length > 0 ? ((counts.healthy / equipment.length) * 100).toFixed(1) : 'N/A';

  drawTitle(ctx, 'Fleet Compliance Overview', 20);

  drawText(ctx, `Generated: ${new Date().toISOString()}`);
  drawText(ctx, `Period: ${formatDate(period.startDate)} to ${formatDate(period.endDate)}`);
  addSpacing(ctx, 10);

  drawSectionHeader(ctx, 'FLEET STATISTICS');

  ctx.page.drawText(`Total Equipment: ${equipment.length}`, {
    x: 50,
    y: ctx.yPosition,
    size: 11,
    font: ctx.font,
  });
  ctx.yPosition -= 20;

  ctx.page.drawText(`Healthy (Compliant): ${counts.healthy}`, {
    x: 50,
    y: ctx.yPosition,
    size: 11,
    font: ctx.font,
    color: COLORS.green,
  });
  ctx.yPosition -= 20;

  ctx.page.drawText(`Warning (Review Required): ${counts.warning}`, {
    x: 50,
    y: ctx.yPosition,
    size: 11,
    font: ctx.font,
    color: COLORS.yellow,
  });
  ctx.yPosition -= 20;

  ctx.page.drawText(`Critical (Non-Compliant): ${counts.critical}`, {
    x: 50,
    y: ctx.yPosition,
    size: 11,
    font: ctx.font,
    color: COLORS.red,
  });
  ctx.yPosition -= 25;

  ctx.page.drawText(`Compliance Rate: ${complianceRate}%`, {
    x: 50,
    y: ctx.yPosition,
    size: 12,
    font: ctx.boldFont,
    color: getComplianceColor(Number(complianceRate) || 0),
  });
  ctx.yPosition -= 40;

  drawSectionHeader(ctx, 'WORK ORDER STATISTICS');

  const completedWOs = workOrders.filter((wo) => wo.status === 'completed').length;
  const openWOs = workOrders.filter((wo) => wo.status === 'open').length;
  const inProgressWOs = workOrders.filter((wo) => wo.status === 'in_progress').length;

  ctx.page.drawText(`Total Work Orders: ${workOrders.length}`, {
    x: 50,
    y: ctx.yPosition,
    size: 11,
    font: ctx.font,
  });
  ctx.yPosition -= 20;

  ctx.page.drawText(`Completed: ${completedWOs}`, {
    x: 50,
    y: ctx.yPosition,
    size: 11,
    font: ctx.font,
    color: COLORS.green,
  });
  ctx.yPosition -= 20;

  ctx.page.drawText(`Open: ${openWOs}`, { x: 50, y: ctx.yPosition, size: 11, font: ctx.font });
  ctx.yPosition -= 20;

  ctx.page.drawText(`In Progress: ${inProgressWOs}`, {
    x: 50,
    y: ctx.yPosition,
    size: 11,
    font: ctx.font,
    color: COLORS.blue,
  });
  ctx.yPosition -= 40;

  drawSectionHeader(ctx, 'APPLICABLE MARITIME STANDARDS');

  for (const standard of MARITIME_STANDARDS.slice(0, 8)) {
    drawText(ctx, `${standard.code}: ${standard.name}`, { size: 9 });
  }

  return ctx.pdfDoc.save();
}
