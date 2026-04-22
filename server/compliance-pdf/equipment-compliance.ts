/**
 * Compliance PDF - Equipment Compliance Report Generation
 */

import type { WorkOrder } from "@shared/schema";
import type { EquipmentHealth } from "../db/equipment/types.js";
import type { ComplianceDeps, ReportingPeriod, EquipmentComplianceOptions } from './types';
import {
  createPDFContext,
  formatDate,
  countByStatus,
  getStatusColor,
  drawTitle,
  drawSectionHeader,
  drawText,
  addSpacing,
} from './utils';

export async function generateEquipmentCompliancePDF(
  storage: ComplianceDeps,
  orgId: string,
  equipmentIds: string[],
  standardCodes: string[],
  reportingPeriod: ReportingPeriod,
  options: EquipmentComplianceOptions
): Promise<Uint8Array> {
  console.log(
    `[Compliance PDF] Generating equipment compliance report for ${equipmentIds.length} units`
  );

  const equipmentHealth = await storage.getEquipmentHealth(orgId);
  const filteredEquipment =
    equipmentIds.length > 0
      ? equipmentHealth.filter((eq) => equipmentIds.includes(eq.id))
      : equipmentHealth;
  const workOrders = await storage.getWorkOrders(undefined, orgId);
  const relevantWorkOrders = workOrders.filter(
    (wo) => wo.equipmentId && equipmentIds.includes(wo.equipmentId)
  );

  return renderEquipmentCompliancePDF(
    filteredEquipment,
    relevantWorkOrders,
    standardCodes,
    reportingPeriod,
    options
  );
}

async function renderEquipmentCompliancePDF(
  equipment: EquipmentHealth[],
  workOrders: WorkOrder[],
  standardCodes: string[],
  period: ReportingPeriod,
  options: EquipmentComplianceOptions
): Promise<Uint8Array> {
  const ctx = await createPDFContext();
  const counts = countByStatus(equipment);

  drawTitle(ctx, `Equipment Compliance ${options.reportType.toUpperCase()} Report`);

  drawSectionHeader(ctx, 'VESSEL INFORMATION');

  const vesselInfo = [
    `Vessel: ${options.vesselName}`,
    `IMO: ${options.imoNumber}`,
    `Flag: ${options.flag}`,
    `Inspector: ${options.inspector}`,
    `Period: ${formatDate(period.startDate)} to ${formatDate(period.endDate)}`,
  ];

  for (const info of vesselInfo) {
    drawText(ctx, info);
  }

  addSpacing(ctx);
  drawSectionHeader(ctx, 'EQUIPMENT SUMMARY');
  drawText(
    ctx,
    `Total: ${equipment.length} | Healthy: ${counts.healthy} | Warning: ${counts.warning} | Critical: ${counts.critical}`
  );

  addSpacing(ctx, 10);
  drawSectionHeader(ctx, 'EQUIPMENT LIST');

  for (const eq of equipment.slice(0, 20)) {
    if (ctx.yPosition < 100) {
      ctx.page = ctx.pdfDoc.addPage([595, 842]);
      ctx.yPosition = 800;
    }

    const status = eq.status || 'unknown';
    ctx.page.drawText(
      `${eq.name || eq.id}: ${status.toUpperCase()} (Health: ${eq.healthIndex || 0})`,
      {
        x: 50,
        y: ctx.yPosition,
        size: 9,
        font: ctx.font,
        color: getStatusColor(status),
      }
    );
    ctx.yPosition -= 15;
  }

  return ctx.pdfDoc.save();
}
