import { Router } from "express";
import { beastModeManager } from "../beast-mode-config.js";
import { InventoryRiskAnalyzer } from "../inventory-risk.js";
import { dbInventoryStorage, dbEquipmentStorage, workOrderService } from "../repositories.js";
import type { InventoryRiskDeps } from "../inventory-risk/analyzer.js";

const router = Router();

const inventoryRiskDeps: InventoryRiskDeps = {
  getPartsInventory: (orgId, includeInactive) =>
    dbInventoryStorage.getPartsInventory(undefined, orgId),
  getEquipment: (orgId, equipmentId) => dbEquipmentStorage.getEquipment(orgId, equipmentId),
  getWorkOrderPartsByEquipment: (orgId, equipmentId) =>
    dbInventoryStorage.getWorkOrderPartsByEquipment(orgId, equipmentId),
  getPartById: (orgId, partId) => dbInventoryStorage.getPartById(partId, orgId),
  getWorkOrderPartsByPartId: (orgId, partId) =>
    dbInventoryStorage.getWorkOrderPartsByPartId(orgId, partId),
  getWorkOrder: (orgId, workOrderId) => workOrderService.getWorkOrderById(workOrderId, orgId),
};

let inventoryRiskAnalyzer: InventoryRiskAnalyzer;
function getInventoryRiskAnalyzer() {
  if (!inventoryRiskAnalyzer) {
    inventoryRiskAnalyzer = new InventoryRiskAnalyzer(inventoryRiskDeps);
  }
  return inventoryRiskAnalyzer;
}

router.post("/inventory/analyze", async (req, res) => {
  try {
    const { orgId } = req.query;
    const { includeInactive } = req.body;
    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid orgId parameter" });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "inventory_risk");
    if (!isEnabled) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Inventory Risk Pod is not enabled for this organization",
          enabled: false,
        });
    }
    console.log(`[Beast Mode API] Inventory risk analysis for org: ${orgId}`);
    const riskSummary = await getInventoryRiskAnalyzer().analyzeInventoryRisk(
      orgId,
      includeInactive || false
    );
    res.json({
      success: true,
      data: riskSummary,
      metadata: {
        analysisDate: new Date().toISOString(),
        podVersion: "1.0",
        orgId,
        includeInactive,
      },
    });
  } catch (error) {
    console.error(`[Beast Mode API] Inventory risk analysis error:`, error);
    res
      .status(500)
      .json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error during inventory risk analysis",
      });
  }
});

router.get("/inventory/equipment/:equipmentId", async (req, res) => {
  try {
    const { orgId } = req.query;
    const { equipmentId } = req.params;
    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid orgId parameter" });
    }

    if (!equipmentId) {
      return res.status(400).json({ success: false, error: "Missing equipmentId parameter" });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "inventory_risk");
    if (!isEnabled) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Inventory Risk Pod is not enabled for this organization",
          enabled: false,
        });
    }
    console.log(`[Beast Mode API] Equipment parts risk analysis for ${equipmentId}`);
    const equipmentRisk = await getInventoryRiskAnalyzer().analyzeEquipmentPartsRisk(
      orgId,
      equipmentId
    );
    if (!equipmentRisk) {
      return res
        .status(404)
        .json({
          success: false,
          error: `Equipment ${equipmentId} not found or no parts history available`,
        });
    }
    res.json({
      success: true,
      data: equipmentRisk,
      metadata: { analysisDate: new Date().toISOString(), podVersion: "1.0", orgId, equipmentId },
    });
  } catch (error) {
    console.error(`[Beast Mode API] Equipment parts risk analysis error:`, error);
    res
      .status(500)
      .json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error during equipment parts risk analysis",
      });
  }
});

router.get("/inventory/critical", async (req, res) => {
  try {
    const { orgId, threshold } = req.query;
    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid orgId parameter" });
    }
    const riskThreshold = threshold ? Number.parseInt(threshold as string) : 75;
    if (Number.isNaN(riskThreshold) || riskThreshold < 0 || riskThreshold > 100) {
      return res
        .status(400)
        .json({ success: false, error: "Risk threshold must be a number between 0 and 100" });
    }
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "inventory_risk");
    if (!isEnabled) {
      return res
        .status(403)
        .json({
          success: false,
          error: "Inventory Risk Pod is not enabled for this organization",
          enabled: false,
        });
    }
    console.log(
      `[Beast Mode API] Critical parts analysis for org: ${orgId}, threshold: ${riskThreshold}`
    );
    const criticalParts = await getInventoryRiskAnalyzer().getCriticalParts(orgId, riskThreshold);
    res.json({
      success: true,
      data: { criticalParts, riskThreshold, criticalCount: criticalParts.length },
      metadata: { analysisDate: new Date().toISOString(), podVersion: "1.0", orgId, riskThreshold },
    });
  } catch (error) {
    console.error(`[Beast Mode API] Critical parts analysis error:`, error);
    res
      .status(500)
      .json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error during critical parts analysis",
      });
  }
});

export { router as beastInventoryRiskRouter };
