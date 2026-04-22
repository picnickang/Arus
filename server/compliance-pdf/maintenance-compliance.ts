/**
 * Compliance PDF - Maintenance Compliance Report Generation
 */

import type { WorkOrder } from "@shared/schema";
import type { EquipmentHealth } from "../db/equipment/types.js";

import type { ComplianceDeps, ReportingPeriod, MaintenanceComplianceOptions } from "./types";
import {
  createPDFContext,
  formatDate,
  getHealthColor,
  drawTitle,
  drawSectionHeader,
  drawText,
  addSpacing,
  COLORS,
} from "./utils";

export async function generateMaintenanceCompliancePDF(
  storage: ComplianceDeps,
  orgId: string,
  vesselId: string,
  period: ReportingPeriod,
  options: MaintenanceComplianceOptions
): Promise<Uint8Array> {
  console.log(`[Compliance PDF] Generating maintenance compliance report for vessel: ${vesselId}`);

  const workOrders = await storage.getWorkOrders(undefined, orgId);
  const equipmentHealth = await storage.getEquipmentHealth(orgId);

  const vesselEquipment = equipmentHealth.filter(
    (eq) => eq.vessel === vesselId || eq.vessel?.includes(vesselId)
  );
  const vesselEquipmentIds = new Set(vesselEquipment.map((eq) => eq.id));

  const vesselWorkOrders = workOrders.filter(
    (wo) =>
      wo.equipmentId &&
      vesselEquipmentIds.has(wo.equipmentId) &&
      wo.createdAt &&
      wo.createdAt >= period.startDate &&
      wo.createdAt <= period.endDate
  );

  return renderMaintenanceCompliancePDF(vesselWorkOrders, vesselEquipment, period, options);
}

async function renderMaintenanceCompliancePDF(
  workOrders: WorkOrder[],
  equipmentHealth: EquipmentHealth[],
  period: ReportingPeriod,
  options: MaintenanceComplianceOptions
): Promise<Uint8Array> {
  const ctx = await createPDFContext();

  drawTitle(ctx, "MAINTENANCE COMPLIANCE REPORT");

  drawText(ctx, `Vessel: ${options.vesselName}`, { size: 12 });
  drawText(ctx, `Period: ${formatDate(period.startDate)} - ${formatDate(period.endDate)}`, {
    size: 12,
  });

  addSpacing(ctx);

  if (options.includeWorkOrders) {
    const completedOrders = workOrders.filter((wo) => wo.status === "completed").length;
    const totalOrders = workOrders.length;
    const completionRate =
      totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : "0";

    drawSectionHeader(ctx, "MAINTENANCE ACTIVITIES");

    drawText(ctx, `Total Work Orders: ${totalOrders}`, { size: 11 });

    const rateColor = completedOrders === totalOrders ? COLORS.green : COLORS.orange;
    ctx.page.drawText(`Completed: ${completedOrders} (${completionRate}%)`, {
      x: 50,
      y: ctx.yPosition,
      size: 11,
      font: ctx.font,
      color: rateColor,
    });
    ctx.yPosition -= 30;
  }

  if (options.includeHealthMetrics && equipmentHealth.length > 0) {
    const avgHealth =
      equipmentHealth.reduce((sum, eq) => sum + (eq.healthIndex ?? 0), 0) / equipmentHealth.length;

    drawSectionHeader(ctx, "EQUIPMENT HEALTH");

    drawText(ctx, `Equipment Units: ${equipmentHealth.length}`, { size: 11 });

    ctx.page.drawText(`Average Health Score: ${avgHealth.toFixed(1)}%`, {
      x: 50,
      y: ctx.yPosition,
      size: 11,
      font: ctx.font,
      color: getHealthColor(avgHealth),
    });
    ctx.yPosition -= 20;
  }

  return ctx.pdfDoc.save();
}
