/**
 * Sensor Bundles API Routes
 *
 * Provides CRUD operations for sensor bundles - predefined groups of sensor templates
 * that can be applied to equipment for quick sensor configuration deployment.
 */

import { Router } from "express";
import { db } from "../db";
import {
  sensorBundles,
  sensorTemplates,
  sensorConfigurations,
  equipment,
} from "@shared/schema-runtime";
import { eq, and, isNull, or, inArray } from "drizzle-orm";
import { z } from "zod";
import { insertSensorBundleSchema } from "@shared/schema-runtime";

const router = Router();

/**
 * GET /api/sensor-bundles
 * List all sensor bundles (system + org-specific), optionally filtered by equipment type
 * Query params:
 *   - equipmentType: Filter by equipment type (e.g., "engine", "pump", "generator")
 */
router.get("/", async (req, res) => {
  try {
    const { equipmentType } = req.query;
    const orgId = res.locals.orgId; // From authentication middleware

    // Build query to get both system bundles (orgId = null) and org-specific bundles
    let query = db
      .select()
      .from(sensorBundles)
      .where(
        or(
          isNull(sensorBundles.orgId), // System bundles
          eq(sensorBundles.orgId, orgId) // Org-specific bundles
        )
      );

    // Apply equipment type filter if provided
    if (equipmentType && typeof equipmentType === "string") {
      query = db
        .select()
        .from(sensorBundles)
        .where(
          and(
            or(isNull(sensorBundles.orgId), eq(sensorBundles.orgId, orgId)),
            eq(sensorBundles.equipmentType, equipmentType)
          )
        );
    }

    const bundles = await query;
    res.json(bundles);
  } catch (error) {
    console.error("[SensorBundles] Error fetching bundles:", error);
    res.status(500).json({
      error: "Failed to fetch sensor bundles",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/sensor-bundles/:id
 * Get a specific sensor bundle with resolved template details
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = res.locals.orgId;

    // Fetch bundle (must be either system bundle or belong to org)
    const [bundle] = await db
      .select()
      .from(sensorBundles)
      .where(
        and(
          eq(sensorBundles.id, id),
          or(isNull(sensorBundles.orgId), eq(sensorBundles.orgId, orgId))
        )
      )
      .limit(1);

    if (!bundle) {
      return res.status(404).json({ error: "Sensor bundle not found" });
    }

    // Resolve template details
    if (bundle.templateIds && bundle.templateIds.length > 0) {
      const templates = await db
        .select()
        .from(sensorTemplates)
        .where(
          and(
            or(isNull(sensorTemplates.orgId), eq(sensorTemplates.orgId, orgId)),
            // Match any of the template IDs in the bundle
            inArray(sensorTemplates.templateId, bundle.templateIds)
          )
        );

      return res.json({
        ...bundle,
        templates, // Include resolved template objects
      });
    }

    res.json(bundle);
  } catch (error) {
    console.error(`[SensorBundles] Error fetching bundle ${req.params.id}:`, error);
    res.status(500).json({
      error: "Failed to fetch sensor bundle",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/sensor-bundles
 * Create a new sensor bundle (org-specific only, not system bundles)
 */
router.post("/", async (req, res) => {
  try {
    const orgId = res.locals.orgId;

    // Validate request body
    const validatedData = insertSensorBundleSchema.parse(req.body);

    // Verify all template IDs exist and are accessible
    if (validatedData.templateIds && validatedData.templateIds.length > 0) {
      const templates = await db
        .select()
        .from(sensorTemplates)
        .where(
          and(
            or(isNull(sensorTemplates.orgId), eq(sensorTemplates.orgId, orgId)),
            inArray(sensorTemplates.templateId, validatedData.templateIds)
          )
        );

      if (templates.length !== validatedData.templateIds.length) {
        const foundIds = templates.map((t) => t.templateId);
        const missingIds = validatedData.templateIds.filter((id) => !foundIds.includes(id));
        return res.status(400).json({
          error: "Some template IDs not found or not accessible",
          missingIds,
        });
      }
    }

    // Create bundle
    const [newBundle] = await db
      .insert(sensorBundles)
      .values({
        ...validatedData,
        orgId, // Set to current org
        isSystemDefault: false, // User bundles are never system defaults
        createdBy: res.locals.userId || "unknown",
      })
      .returning();

    res.status(201).json(newBundle);
  } catch {
    console.error("[SensorBundles] Error creating bundle:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }
    res.status(500).json({
      error: "Failed to create sensor bundle",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * PUT /api/sensor-bundles/:id
 * Update an existing sensor bundle (only org-specific bundles, not system bundles)
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = res.locals.orgId;

    // Check bundle exists and belongs to org (not system bundle)
    const [existing] = await db
      .select()
      .from(sensorBundles)
      .where(
        and(
          eq(sensorBundles.id, id),
          eq(sensorBundles.orgId, orgId), // Must belong to org
          eq(sensorBundles.isSystemDefault, false) // Cannot update system bundles
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({
        error: "Sensor bundle not found or cannot be modified (system bundles are read-only)",
      });
    }

    // Validate request body (partial update allowed)
    const updateSchema = insertSensorBundleSchema.partial();
    const validatedData = updateSchema.parse(req.body);

    // Verify template IDs if provided
    if (validatedData.templateIds && validatedData.templateIds.length > 0) {
      const templates = await db
        .select()
        .from(sensorTemplates)
        .where(
          and(
            or(isNull(sensorTemplates.orgId), eq(sensorTemplates.orgId, orgId)),
            inArray(sensorTemplates.templateId, validatedData.templateIds)
          )
        );

      if (templates.length !== validatedData.templateIds.length) {
        const foundIds = templates.map((t) => t.templateId);
        const missingIds = validatedData.templateIds.filter((tid) => !foundIds.includes(tid));
        return res.status(400).json({
          error: "Some template IDs not found or not accessible",
          missingIds,
        });
      }
    }

    // Update bundle
    const [updatedBundle] = await db
      .update(sensorBundles)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(sensorBundles.id, id))
      .returning();

    res.json(updatedBundle);
  } catch {
    console.error(`[SensorBundles] Error updating bundle ${req.params.id}:`, error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }
    res.status(500).json({
      error: "Failed to update sensor bundle",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * DELETE /api/sensor-bundles/:id
 * Delete a sensor bundle (only org-specific bundles, not system bundles)
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = res.locals.orgId;

    // Check bundle exists and belongs to org (not system bundle)
    const [existing] = await db
      .select()
      .from(sensorBundles)
      .where(
        and(
          eq(sensorBundles.id, id),
          eq(sensorBundles.orgId, orgId),
          eq(sensorBundles.isSystemDefault, false)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({
        error: "Sensor bundle not found or cannot be deleted (system bundles are protected)",
      });
    }

    // Delete bundle
    await db.delete(sensorBundles).where(eq(sensorBundles.id, id));

    res.status(204).send();
  } catch (error) {
    console.error(`[SensorBundles] Error deleting bundle ${req.params.id}:`, error);
    res.status(500).json({
      error: "Failed to delete sensor bundle",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/sensor-bundles/apply/:equipmentId
 * Apply a sensor bundle to equipment - creates multiple sensor configurations at once
 * Body: { bundleId: string }
 * Returns: { created: number, skipped: number, sensors: SensorConfiguration[] }
 */
router.post("/apply/:equipmentId", async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { bundleId } = req.body;
    const orgId = res.locals.orgId;

    if (!bundleId) {
      return res.status(400).json({ error: "bundleId is required" });
    }

    // Start transaction for atomicity
    const result = await db.transaction(async (tx) => {
      // 1. Verify equipment ownership
      const [equipmentRecord] = await tx
        .select()
        .from(equipment)
        .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
        .limit(1);

      if (!equipmentRecord) {
        throw new Error("Equipment not found or not accessible");
      }

      // 2. Load bundle (must be system or org bundle)
      const [bundle] = await tx
        .select()
        .from(sensorBundles)
        .where(
          and(
            eq(sensorBundles.bundleId, bundleId),
            or(isNull(sensorBundles.orgId), eq(sensorBundles.orgId, orgId))
          )
        )
        .limit(1);

      if (!bundle) {
        throw new Error("Sensor bundle not found");
      }

      if (!bundle.templateIds || bundle.templateIds.length === 0) {
        throw new Error("Bundle contains no templates");
      }

      // 3. Load all templates from the bundle
      const templates = await tx
        .select()
        .from(sensorTemplates)
        .where(
          and(
            or(isNull(sensorTemplates.orgId), eq(sensorTemplates.orgId, orgId)),
            inArray(sensorTemplates.templateId, bundle.templateIds)
          )
        );

      if (templates.length === 0) {
        throw new Error("No accessible templates found in bundle");
      }

      // 4. Check for existing sensors to avoid duplicates
      const existingSensors = await tx
        .select()
        .from(sensorConfigurations)
        .where(
          and(
            eq(sensorConfigurations.equipmentId, equipmentId),
            eq(sensorConfigurations.orgId, orgId)
          )
        );

      const existingSensorTypes = new Set(existingSensors.map((s) => s.sensorType));

      // 5. Create sensor configs from templates (skip duplicates)
      const createdSensors = [];
      let skipped = 0;

      for (const template of templates) {
        // Skip if sensor type already exists on this equipment
        if (existingSensorTypes.has(template.kind)) {
          skipped++;
          continue;
        }

        // Map template fields to sensor config fields
        const fields = template.fields as Record<string, any>;

        const [newSensor] = await tx
          .insert(sensorConfigurations)
          .values({
            orgId,
            equipmentId,
            sensorType: template.kind,
            enabled: true,
            sampleRateHz:
              fields.sample_rate_hz ?? (fields.sample_rate_sec ? 1 / fields.sample_rate_sec : 1),
            gain: fields.gain ?? 1,
            offset: fields.offset ?? 0,
            deadband: fields.deadband ?? 0,
            minValid: fields.min_valid ?? null,
            maxValid: fields.max_valid ?? null,
            warnLo: fields.warn_low ?? fields.warnLo ?? null,
            warnHi: fields.warn_high ?? fields.warnHi ?? fields.warn_rms ?? null,
            critLo: fields.crit_low ?? fields.critLo ?? null,
            critHi: fields.crit_high ?? fields.critHi ?? fields.crit_rms ?? null,
            hysteresis: fields.hysteresis ?? 0,
            emaAlpha: fields.ema_alpha ?? 0.1,
            targetUnit: template.unit,
            notes: template.notes ?? `Auto-created from bundle: ${bundle.name}`,
          })
          .returning();

        createdSensors.push(newSensor);
      }

      return {
        created: createdSensors.length,
        skipped,
        sensors: createdSensors,
        bundleName: bundle.name,
      };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error(
      `[SensorBundles] Error applying bundle to equipment ${req.params.equipmentId}:`,
      error
    );
    res.status(500).json({
      error: "Failed to apply sensor bundle",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
