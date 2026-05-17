import { Router } from "express";
import { beastModeManager, type BeastModeFeature, DEFAULT_ORG_ID } from "../beast-mode-config.js";
import { z } from "zod";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Beast:ConfigRoutes");

const router = Router();

function isValidBeastModeFeature(feature: string): feature is BeastModeFeature {
  return [
    "vibration_analysis",
    "weibull_rul",
    "lp_optimizer",
    "enhanced_trends",
    "inventory_risk",
    "compliance_pdf",
  ].includes(feature);
}

const toggleFeatureSchema = z.object({
  feature: z.enum([
    "vibration_analysis",
    "weibull_rul",
    "lp_optimizer",
    "enhanced_trends",
    "inventory_risk",
    "compliance_pdf",
  ]),
  enabled: z.boolean(),
  configuration: z.any().optional(),
});

router.get("/config", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const configs = await (beastModeManager as any).getAllFeatureConfigs(orgId);
    res.json({
      success: true,
      orgId,
      features: configs,
      message: "Beast Mode features are disabled by default for safety",
    });
  } catch (error) {
    logger.error("[Beast Mode API] Error getting configs:", undefined, error);
    res.status(500).json({ success: false, error: "Failed to retrieve Beast Mode configurations" });
  }
});

router.get("/config/:feature", async (req, res) => {
  try {
    const { feature } = req.params;
    const orgId = DEFAULT_ORG_ID;
    if (!isValidBeastModeFeature(feature)) {
      return res
        .status(400)
        .json({
          success: false,
          error: `Invalid feature name: ${feature}`,
          validFeatures: [
            "vibration_analysis",
            "weibull_rul",
            "lp_optimizer",
            "enhanced_trends",
            "inventory_risk",
            "compliance_pdf",
          ],
        });
    }
    const config = await (beastModeManager as any).getFeatureConfig(orgId, feature);
    res.json({ success: true, feature, config, orgId });
  } catch (error) {
    logger.error(`[Beast Mode API] Error getting config for ${req.params.feature}:`, undefined, error);
    res
      .status(500)
      .json({
        success: false,
        error: `Failed to retrieve configuration for ${req.params.feature}`,
      });
  }
});

router.post("/config/:feature/toggle", async (req, res) => {
  try {
    const { feature } = req.params;
    const orgId = DEFAULT_ORG_ID;
    if (!isValidBeastModeFeature(feature)) {
      return res
        .status(400)
        .json({
          success: false,
          error: `Invalid feature name: ${feature}`,
          validFeatures: [
            "vibration_analysis",
            "weibull_rul",
            "lp_optimizer",
            "enhanced_trends",
            "inventory_risk",
            "compliance_pdf",
          ],
        });
    }
    const validation = toggleFeatureSchema.safeParse({ ...req.body, feature });
    if (!validation.success) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Invalid request body",
          details: validation.error.format(),
        });
    }
    const { enabled, configuration } = validation.data;
    const lastModifiedBy = (req.headers["x-user-id"] as string) || "api";
    let result: boolean;
    if (enabled) {
      result = await (beastModeManager as any).enableFeature(orgId, feature, configuration, lastModifiedBy);
    } else {
      result = await (beastModeManager as any).disableFeature(orgId, feature, lastModifiedBy);
    }

    if (result) {
      res.json({
        success: true,
        feature,
        enabled,
        orgId,
        message: `Feature ${feature} ${enabled ? "enabled" : "disabled"} successfully`,
      });
    } else {
      res
        .status(500)
        .json({
          success: false,
          error: `Failed to ${enabled ? "enable" : "disable"} feature ${feature}`,
        });
    }
  } catch (error) {
    logger.error(`[Beast Mode API] Error toggling ${req.params.feature}:`, undefined, error);
    res
      .status(500)
      .json({ success: false, error: `Failed to toggle feature ${req.params.feature}` });
  }
});

router.get("/health", async (req, res) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const configs = await (beastModeManager as any).getAllFeatureConfigs(orgId);
    const enabledFeatures = Object.entries(configs)
      .filter(([_, config]: [string, any]) => config.enabled)
      .map(([feature, _]) => feature);
    res.json({
      success: true,
      status: "Beast Mode system operational",
      database: "connected",
      totalFeatures: 6,
      enabledFeatures: enabledFeatures.length,
      enabledList: enabledFeatures,
      orgId,
      phase: "Phase 1 - Safe Enablement Complete",
    });
  } catch (error) {
    logger.error("[Beast Mode API] Health check failed:", undefined, error);
    res
      .status(500)
      .json({
        success: false,
        status: "Beast Mode system error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
  }
});

export { router as beastConfigRouter };
