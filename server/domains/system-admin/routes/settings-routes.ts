/**
 * System Admin Routes - System Settings
 * Admin system settings CRUD and ML threshold calibration
 */

import { Express, Request, Response, z, SystemAdminDependencies } from "./types.js";
import {
  withErrorHandling,
  sendNotFound,
  sendCreated,
  sendDeleted,
} from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";
import { dbSystemAdminStorage } from "../../../db/system-admin/index.js";
import {
  getArtifactBackendSetting,
  setArtifactBackendSetting,
  configureArtifactBackendSettingPort,
  type ArtifactBackend,
  type ArtifactBackendSettingPort,
} from "../../../services/ml-artifact-storage-settings";

// Inverted dependency (see ArtifactBackendSettingPort docstring): the
// pdm-platform factory used to import `dbSystemAdminStorage` directly,
// which the domain-leak check flags as a cross-domain coupling. We
// instead inject a port from this (system-admin) module so the setting
// row stays owned by system-admin while the factory stays domain-pure.
const SETTING_ORG = "system";
const SETTING_CATEGORY = "ml-artifact-storage";
const SETTING_KEY = "backend";

// Settings whose key names look credential-like are write-only: GETs
// replace their value with a masked marker so secrets stored in the
// jsonb value column never reach clients or logs.
const SECRET_SETTING_KEY_RE = /api[-_]?key|password|secret|token|credential/i;

function redactSecretSetting<T extends { key?: string | null; value?: unknown }>(setting: T): T {
  if (setting.key && SECRET_SETTING_KEY_RE.test(setting.key)) {
    return { ...setting, value: { masked: true } };
  }
  return setting;
}
const VALID_BACKENDS = ["local", "replit-object-storage"] as const;

const artifactBackendSettingPort: ArtifactBackendSettingPort = {
  async read() {
    const row = await dbSystemAdminStorage.getAdminSystemSetting(
      SETTING_ORG,
      SETTING_CATEGORY,
      SETTING_KEY,
    );
    const value = (row?.value as { backend?: string } | undefined)?.backend;
    if (value && (VALID_BACKENDS as readonly string[]).includes(value)) {
      return value as ArtifactBackend;
    }
    return null;
  },
  async write(backend) {
    const existing = await dbSystemAdminStorage.getAdminSystemSetting(
      SETTING_ORG,
      SETTING_CATEGORY,
      SETTING_KEY,
    );
    if (existing) {
      await dbSystemAdminStorage.updateAdminSystemSetting(existing.id, {
        value: { backend },
      });
    } else {
      await dbSystemAdminStorage.createAdminSystemSetting({
        orgId: SETTING_ORG,
        category: SETTING_CATEGORY,
        key: SETTING_KEY,
        value: { backend },
        description: "Backend used for storing trained ML model artifacts",
      });
    }
  },
};
configureArtifactBackendSettingPort(artifactBackendSettingPort);

export function registerSettingsRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    generalApiRateLimit,
    writeOperationRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    thresholdCalibrator,
    insertAdminSystemSettingSchema,
  } = deps;

  app.get(
    "/api/admin/settings",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_SYSTEM_SETTINGS"),
    withErrorHandling("fetch admin system settings", async (req: Request, res: Response) => {
      const { orgId, category } = req.query;
      const settings = await dbSystemAdminStorage.getAdminSystemSettings(
        orgId as string,
        category as string
      );
      res.json(settings.map(redactSecretSetting));
    })
  );

  app.get(
    "/api/admin/settings/:orgId/:category/:key",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_SYSTEM_SETTING"),
    withErrorHandling("fetch admin system setting", async (req: Request, res: Response) => {
      const { orgId = '', category = '', key = '' } = req.params;
      const setting = await dbSystemAdminStorage.getAdminSystemSetting(orgId, category, key);
      if (!setting) {
        return sendNotFound(res, "System setting");
      }
      res.json(redactSecretSetting(setting));
    })
  );

  app.post(
    "/api/admin/settings",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CREATE_SYSTEM_SETTING"),
    withErrorHandling("create admin system setting", async (req: Request, res: Response) => {
      const validatedData = insertAdminSystemSettingSchema.parse(req.body);
      const setting = await dbSystemAdminStorage.createAdminSystemSetting(validatedData);
      sendCreated(res, setting);
    })
  );

  app.put(
    "/api/admin/settings/:id",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("UPDATE_SYSTEM_SETTING"),
    withErrorHandling("update admin system setting", async (req: Request, res: Response) => {
      const { id = '' } = req.params;
      const validatedData = (
        insertAdminSystemSettingSchema as object as import("zod").AnyZodObject
      ).partial().parse(req.body);
      const setting = await dbSystemAdminStorage.updateAdminSystemSetting(id, validatedData);
      res.json(setting);
    })
  );

  app.delete(
    "/api/admin/settings/:id",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("DELETE_SYSTEM_SETTING"),
    withErrorHandling("delete admin system setting", async (req: Request, res: Response) => {
      const { id = '' } = req.params;
      await dbSystemAdminStorage.deleteAdminSystemSetting(id);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/admin/settings/:orgId/:category",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_SETTINGS_BY_CATEGORY"),
    withErrorHandling("fetch settings by category", async (req: Request, res: Response) => {
      const { orgId = '', category = '' } = req.params;
      const settings = await dbSystemAdminStorage.getSettingsByCategory(orgId, category);
      res.json(settings);
    })
  );

  app.post(
    "/api/admin/calibrate-threshold",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CALIBRATE_ML_THRESHOLD"),
    withErrorHandling("calibrate ML threshold", async (req: Request, res: Response) => {
      const calibrationSchema = z.object({
        equipmentId: z.string().min(1, "Equipment ID is required"),
      });

      const { equipmentId } = calibrationSchema.parse(req.body);

      const orgId = (req as Request & { session?: { orgId?: string } }).session?.orgId;
      if (!orgId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      logger.info(
        "AdminSettings",
        `Calibrating threshold for equipment ${equipmentId} (org: ${orgId})`
      );

      const result = await thresholdCalibrator.calibrateForEquipment(orgId, equipmentId);

      try {
        const { realtimePredictionEngine } = await import("../../../ml-realtime-prediction.js");
        realtimePredictionEngine.invalidateThresholdCache(equipmentId);
      } catch (cacheError) {
        logger.warn("AdminSettings", "Could not invalidate threshold cache", cacheError);
      }

      res.status(200).json({
        success: true,
        equipmentId,
        threshold: result['threshold'],
        sampleCount: result['sampleCount'],
        statistics: result['statistics'],
        calibratedAt: result['calibratedAt'],
        method: result['method'],
      });
    })
  );

  // #108 — ML artifact storage backend selection.
  // Backend is persisted in admin_system_settings (orgId=system,
  // category=ml-artifact-storage, key=backend). Only affects NEW
  // writes; already-deployed model rows keep their URIs and resolve
  // through whichever backend originally wrote them.
  app.get(
    "/api/admin/ml-artifact-storage",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_ML_ARTIFACT_STORAGE"),
    withErrorHandling("fetch ML artifact storage backend", async (_req: Request, res: Response) => {
      const config = await getArtifactBackendSetting();
      res.json(config);
    })
  );

  app.put(
    "/api/admin/ml-artifact-storage",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("UPDATE_ML_ARTIFACT_STORAGE"),
    withErrorHandling("update ML artifact storage backend", async (req: Request, res: Response) => {
      const schema = z.object({
        backend: z.enum(["local", "replit-object-storage"]),
      });
      const parsed = schema.parse(req.body);
      await setArtifactBackendSetting(parsed.backend as ArtifactBackend);
      const config = await getArtifactBackendSetting();
      res.json(config);
    })
  );
}
