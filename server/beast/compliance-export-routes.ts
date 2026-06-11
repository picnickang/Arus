import { Router } from "express";
import { beastModeManager } from "../beast-mode-config.js";
import { CompliancePDFGenerator } from "../compliance-pdf.js";
import { ComplianceExcelGenerator } from "../compliance-excel.js";
import { dbEquipmentStorage, workOrderService } from "../repositories.js";
import type { ComplianceDeps } from "../compliance-pdf/types";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Beast:ComplianceExportRoutes");

const router = Router();

const complianceDeps: ComplianceDeps = {
  getEquipmentHealth: (orgId, filters) => dbEquipmentStorage.getEquipmentHealth(orgId, filters),
  getWorkOrders: (equipmentId, orgId, filters) =>
    workOrderService.getWorkOrdersWithDetails(equipmentId, orgId, filters),
};

let compliancePDFGenerator: CompliancePDFGenerator;
let complianceExcelGenerator: ComplianceExcelGenerator;

function getCompliancePDFGenerator() {
  if (!compliancePDFGenerator) {
    compliancePDFGenerator = new CompliancePDFGenerator(complianceDeps);
  }
  return compliancePDFGenerator;
}

function getComplianceExcelGenerator() {
  if (!complianceExcelGenerator) {
    complianceExcelGenerator = new ComplianceExcelGenerator(complianceDeps);
  }
  return complianceExcelGenerator;
}

router.post("/compliance/equipment-pdf", async (req, res) => {
  try {
    const { orgId } = req.query;
    const {
      equipmentIds,
      standardCodes,
      reportingPeriod,
      vesselName,
      imoNumber,
      flag,
      reportType,
      inspector,
    } = req.body;
    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid orgId parameter" });
    }
    if (!equipmentIds || !Array.isArray(equipmentIds) || equipmentIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Missing or invalid equipmentIds array" });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "compliance_pdf");
    if (!isEnabled) {
      return res.status(403).json({
        success: false,
        error: "Compliance PDF Pod is not enabled for this organization",
        enabled: false,
      });
    }
    logger.info(
      `[Beast Mode API] Equipment compliance PDF generation for ${equipmentIds.length} units`
    );
    const pdfData = await getCompliancePDFGenerator().generateEquipmentCompliancePDF(
      orgId,
      equipmentIds,
      standardCodes ?? ["ABS-A1-MACHINERY"],
      {
        startDate: new Date(reportingPeriod?.startDate ?? Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(reportingPeriod?.endDate ?? Date.now()),
      },
      {
        vesselName: vesselName ?? "Unknown Vessel",
        imoNumber: imoNumber ?? "N/A",
        flag: flag ?? "N/A",
        reportType: reportType ?? "inspection",
        inspector: inspector ?? "ARUS System",
      }
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="equipment-compliance-${Date.now()}.pdf"`
    );
    return res.send(Buffer.from(pdfData));
  } catch (error) {
    logger.error(`[Beast Mode API] Equipment compliance PDF error:`, undefined, error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error during PDF generation",
    });
  }
});

router.post("/compliance/maintenance-pdf", async (req, res) => {
  try {
    const { orgId } = req.query;
    const { vesselId, reportingPeriod, vesselName, includeWorkOrders, includeHealthMetrics } =
      req.body;
    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid orgId parameter" });
    }
    if (!vesselId) {
      return res.status(400).json({ success: false, error: "Missing vesselId parameter" });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "compliance_pdf");
    if (!isEnabled) {
      return res.status(403).json({
        success: false,
        error: "Compliance PDF Pod is not enabled for this organization",
        enabled: false,
      });
    }
    logger.info(`[Beast Mode API] Maintenance compliance PDF generation for vessel: ${vesselId}`);
    const pdfData = await getCompliancePDFGenerator().generateMaintenanceCompliancePDF(
      orgId,
      vesselId,
      {
        startDate: new Date(reportingPeriod?.startDate ?? Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(reportingPeriod?.endDate ?? Date.now()),
      },
      {
        vesselName: vesselName ?? "Unknown Vessel",
        includeWorkOrders: includeWorkOrders !== false,
        includeHealthMetrics: includeHealthMetrics !== false,
      }
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="maintenance-compliance-${vesselId}-${Date.now()}.pdf"`
    );
    return res.send(Buffer.from(pdfData));
  } catch (error) {
    logger.error(`[Beast Mode API] Maintenance compliance PDF error:`, undefined, error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error during PDF generation",
    });
  }
});

router.post("/compliance/regulatory-pdf", async (req, res) => {
  try {
    const { orgId } = req.query;
    const { regulatoryFramework, equipmentIds, reportingPeriod } = req.body;
    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid orgId parameter" });
    }
    const validFrameworks = ["IMO", "ABS", "DNV", "USCG"];
    if (!regulatoryFramework || !validFrameworks.includes(regulatoryFramework)) {
      return res.status(400).json({
        success: false,
        error: `Invalid regulatory framework. Must be one of: ${validFrameworks.join(", ")}`,
      });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "compliance_pdf");
    if (!isEnabled) {
      return res.status(403).json({
        success: false,
        error: "Compliance PDF Pod is not enabled for this organization",
        enabled: false,
      });
    }
    logger.info(
      `[Beast Mode API] Regulatory compliance PDF generation for framework: ${regulatoryFramework}`
    );
    const pdfData = await getCompliancePDFGenerator().generateRegulatoryCompliancePDF(
      orgId,
      regulatoryFramework,
      equipmentIds ?? [],
      {
        startDate: new Date(reportingPeriod?.startDate ?? Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(reportingPeriod?.endDate ?? Date.now()),
      }
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${regulatoryFramework.toLowerCase()}-compliance-${Date.now()}.pdf"`
    );
    return res.send(Buffer.from(pdfData));
  } catch (error) {
    logger.error(`[Beast Mode API] Regulatory compliance PDF error:`, undefined, error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error during PDF generation",
    });
  }
});

router.post("/compliance/fleet-pdf", async (req, res) => {
  try {
    const { orgId } = req.query;
    const { reportingPeriod } = req.body;
    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid orgId parameter" });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "compliance_pdf");
    if (!isEnabled) {
      return res.status(403).json({
        success: false,
        error: "Compliance PDF Pod is not enabled for this organization",
        enabled: false,
      });
    }
    logger.info(`[Beast Mode API] Fleet compliance PDF generation for org: ${orgId}`);
    const pdfData = await getCompliancePDFGenerator().generateFleetComplianceOverviewPDF(orgId, {
      startDate: new Date(reportingPeriod?.startDate ?? Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(reportingPeriod?.endDate ?? Date.now()),
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="fleet-compliance-overview-${Date.now()}.pdf"`
    );
    return res.send(Buffer.from(pdfData));
  } catch (error) {
    logger.error(`[Beast Mode API] Fleet compliance PDF error:`, undefined, error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error during PDF generation",
    });
  }
});

router.post("/compliance/equipment-excel", async (req, res) => {
  try {
    const { orgId, equipmentIds, standardCodes, reportingPeriod, vesselName } = req.body;
    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid orgId parameter" });
    }
    if (!equipmentIds || !Array.isArray(equipmentIds) || equipmentIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Missing or invalid equipmentIds array" });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "compliance_pdf");
    if (!isEnabled) {
      return res.status(403).json({
        success: false,
        error: "Compliance Export Pod is not enabled for this organization",
        enabled: false,
      });
    }
    logger.info(
      `[Beast Mode API] Equipment compliance Excel generation for ${equipmentIds.length} units`
    );
    const excelData = await getComplianceExcelGenerator().generateEquipmentComplianceExcel(
      orgId,
      equipmentIds,
      standardCodes ?? ["ABS-A1-MACHINERY"],
      {
        startDate: new Date(reportingPeriod?.startDate ?? Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(reportingPeriod?.endDate ?? Date.now()),
      },
      {
        vesselName: vesselName ?? "Unknown Vessel",
        imoNumber: req.body.imoNumber ?? "N/A",
        flag: req.body.flag ?? "N/A",
        reportType: req.body.reportType ?? "inspection",
        inspector: req.body.inspector ?? "ARUS System",
      }
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="equipment-compliance-${Date.now()}.xlsx"`
    );
    return res.send(excelData);
  } catch (error) {
    logger.error(`[Beast Mode API] Equipment compliance Excel error:`, undefined, error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Internal server error during Excel generation",
    });
  }
});

router.post("/compliance/maintenance-excel", async (req, res) => {
  try {
    const {
      orgId,
      vesselId,
      reportingPeriod,
      vesselName,
      includeWorkOrders,
      includeHealthMetrics,
    } = req.body;
    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid orgId parameter" });
    }
    if (!vesselId || typeof vesselId !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Missing or invalid vesselId parameter" });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "compliance_pdf");
    if (!isEnabled) {
      return res.status(403).json({
        success: false,
        error: "Compliance Export Pod is not enabled for this organization",
        enabled: false,
      });
    }
    logger.info(`[Beast Mode API] Maintenance compliance Excel generation for vessel: ${vesselId}`);
    const excelData = await getComplianceExcelGenerator().generateMaintenanceComplianceExcel(
      orgId,
      vesselId,
      {
        startDate: new Date(reportingPeriod?.startDate ?? Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(reportingPeriod?.endDate ?? Date.now()),
      },
      {
        vesselName: vesselName ?? vesselId,
        includeWorkOrders: includeWorkOrders !== false,
        includeHealthMetrics: includeHealthMetrics !== false,
      }
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="maintenance-compliance-${vesselId}-${Date.now()}.xlsx"`
    );
    return res.send(excelData);
  } catch (error) {
    logger.error(`[Beast Mode API] Maintenance compliance Excel error:`, undefined, error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Internal server error during Excel generation",
    });
  }
});

router.post("/compliance/regulatory-excel", async (req, res) => {
  try {
    const { orgId, regulatoryFramework, equipmentIds, reportingPeriod } = req.body;
    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid orgId parameter" });
    }
    const validFrameworks = ["IMO", "ABS", "DNV", "USCG"];
    if (!regulatoryFramework || !validFrameworks.includes(regulatoryFramework)) {
      return res.status(400).json({
        success: false,
        error: `Invalid regulatory framework. Must be one of: ${validFrameworks.join(", ")}`,
      });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "compliance_pdf");
    if (!isEnabled) {
      return res.status(403).json({
        success: false,
        error: "Compliance Export Pod is not enabled for this organization",
        enabled: false,
      });
    }
    logger.info(
      `[Beast Mode API] Regulatory compliance Excel generation for framework: ${regulatoryFramework}`
    );
    const excelData = await getComplianceExcelGenerator().generateRegulatoryComplianceExcel(
      orgId,
      regulatoryFramework,
      equipmentIds ?? [],
      {
        startDate: new Date(reportingPeriod?.startDate ?? Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(reportingPeriod?.endDate ?? Date.now()),
      }
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${regulatoryFramework.toLowerCase()}-compliance-${Date.now()}.xlsx"`
    );
    return res.send(excelData);
  } catch (error) {
    logger.error(`[Beast Mode API] Regulatory compliance Excel error:`, undefined, error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Internal server error during Excel generation",
    });
  }
});

router.post("/compliance/fleet-excel", async (req, res) => {
  try {
    const { orgId, reportingPeriod } = req.body;
    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid orgId parameter" });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "compliance_pdf");
    if (!isEnabled) {
      return res.status(403).json({
        success: false,
        error: "Compliance Export Pod is not enabled for this organization",
        enabled: false,
      });
    }
    logger.info(`[Beast Mode API] Fleet compliance Excel generation for org: ${orgId}`);
    const excelData = await getComplianceExcelGenerator().generateFleetComplianceOverviewExcel(
      orgId,
      {
        startDate: new Date(reportingPeriod?.startDate ?? Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(reportingPeriod?.endDate ?? Date.now()),
      }
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="fleet-compliance-overview-${Date.now()}.xlsx"`
    );
    return res.send(excelData);
  } catch (error) {
    logger.error(`[Beast Mode API] Fleet compliance Excel error:`, undefined, error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Internal server error during Excel generation",
    });
  }
});

export { router as beastComplianceExportRouter };
