/**
 * Compliance PDF - Regulatory Compliance Report Generation
 */

import type { EquipmentHealth, WorkOrder } from '@shared/schema-runtime';
import type { IStorage } from '../storage.js';
import { MARITIME_STANDARDS } from '../compliance.js';
import type { ReportingPeriod, RegulatoryFramework } from './types';
import { FRAMEWORK_STANDARDS } from './types';
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

export async function generateRegulatoryCompliancePDF(
  storage: IStorage,
  orgId: string,
  regulatoryFramework: RegulatoryFramework,
  equipmentIds: string[],
  period: ReportingPeriod
): Promise<Uint8Array> {
  console.log(
    `[Compliance PDF] Generating regulatory compliance for framework: ${regulatoryFramework}`
  );

  const standardCodes = FRAMEWORK_STANDARDS[regulatoryFramework] || ['ABS-A1-MACHINERY'];

  const equipmentHealth = await storage.getEquipmentHealth(orgId);
  const filteredEquipment =
    equipmentIds.length > 0
      ? equipmentHealth.filter((eq) => equipmentIds.includes(eq.id))
      : equipmentHealth;
  const workOrders = await storage.getWorkOrders(undefined, orgId);

  return renderRegulatoryCompliancePDF(
    filteredEquipment,
    workOrders,
    regulatoryFramework,
    standardCodes,
    period
  );
}

async function renderRegulatoryCompliancePDF(
  equipment: EquipmentHealth[],
  workOrders: WorkOrder[],
  framework: string,
  standardCodes: string[],
  period: ReportingPeriod
): Promise<Uint8Array> {
  const ctx = await createPDFContext();
  const counts = countByStatus(equipment);
  const complianceRate =
    equipment.length > 0 ? ((counts.healthy / equipment.length) * 100).toFixed(1) : 'N/A';

  drawTitle(ctx, `${framework} Regulatory Compliance Report`);

  drawText(ctx, `Period: ${formatDate(period.startDate)} to ${formatDate(period.endDate)}`);
  addSpacing(ctx, 10);

  drawSectionHeader(ctx, 'COMPLIANCE STATUS');

  ctx.page.drawText(`Compliance Rate: ${complianceRate}%`, {
    x: 50,
    y: ctx.yPosition,
    size: 12,
    font: ctx.boldFont,
    color: getComplianceColor(Number(complianceRate) || 0),
  });
  ctx.yPosition -= 25;

  drawText(ctx, `Total Equipment: ${equipment.length}`);
  ctx.page.drawText(`Compliant: ${counts.healthy}`, {
    x: 50,
    y: ctx.yPosition,
    size: 10,
    font: ctx.font,
    color: COLORS.green,
  });
  ctx.yPosition -= 15;

  ctx.page.drawText(`Non-Compliant: ${equipment.length - counts.healthy}`, {
    x: 50,
    y: ctx.yPosition,
    size: 10,
    font: ctx.font,
    color: COLORS.red,
  });
  ctx.yPosition -= 30;

  drawSectionHeader(ctx, 'APPLICABLE STANDARDS');

  for (const code of standardCodes) {
    const standard = MARITIME_STANDARDS.find((s) => s.code === code);
    if (standard) {
      drawText(ctx, `${standard.code}: ${standard.name}`, { size: 9 });
    }
  }

  return ctx.pdfDoc.save();
}
