/**
 * Sensor Templates API Routes
 *
 * Provides CRUD operations for sensor templates - reusable sensor configurations
 * that define sensor kind, thresholds, sample rates, and other parameters.
 */

import { Router } from "express";
import { db } from "../db";
import { sensorTemplates, sensorBundles } from "@shared/schema-runtime";
import { eq, and, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { insertSensorTemplateSchema } from "@shared/schema-runtime";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Routes:SensorTemplates");

const router = Router();

/**
 * GET /api/sensor-templates
 * List all sensor templates (system + org-specific)
 * Query params:
 *   - kind: Filter by sensor kind (e.g., "vibration", "temperature", "pressure")
 *   - equipmentType: Filter by compatible equipment type
 *
 * Note: equipmentType filtering is done post-query (in-memory) since Drizzle doesn't
 * natively support array column filtering. For large datasets, consider server-side
 * filtering with raw SQL if performance becomes an issue.
 */
router.get("/", async (req, res) => {
  try {
    const { kind, equipmentType } = req.query;
    const orgId = res.locals.orgId; // From authentication middleware

    // Build base query: system templates (orgId = null) + org-specific templates
    const query = db
      .select()
      .from(sensorTemplates)
      .where(
        or(
          isNull(sensorTemplates.orgId), // System templates
          eq(sensorTemplates.orgId, orgId) // Org-specific templates
        )
      );

    // Note: Drizzle doesn't support filtering on array columns directly in WHERE
    // We'll filter client-side or use raw SQL if needed for equipmentType
    const templates = await query;

    // Post-process filters
    let filtered = templates;

    if (kind && typeof kind === "string") {
      filtered = filtered.filter((t) => t.kind === kind);
    }

    if (equipmentType && typeof equipmentType === "string") {
      filtered = filtered.filter(
        (t) => t.equipmentTypes && t.equipmentTypes.includes(equipmentType)
      );
    }

    res.json(filtered);
  } catch (error) {
    logger.error("[SensorTemplates] Error fetching templates:", undefined, error);
    res.status(500).json({
      error: "Failed to fetch sensor templates",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/sensor-templates/:id
 * Get a specific sensor template by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = res.locals.orgId;

    // Fetch template (must be either system template or belong to org)
    const [template] = await db
      .select()
      .from(sensorTemplates)
      .where(
        and(
          eq(sensorTemplates.id, id),
          or(isNull(sensorTemplates.orgId), eq(sensorTemplates.orgId, orgId))
        )
      )
      .limit(1);

    if (!template) {
      return res.status(404).json({ error: "Sensor template not found" });
    }

    res.json(template);
  } catch (error) {
    logger.error(`[SensorTemplates] Error fetching template ${req.params.id}:`, undefined, error);
    res.status(500).json({
      error: "Failed to fetch sensor template",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/sensor-templates
 * Create a new sensor template (org-specific only, not system templates)
 */
router.post("/", async (req, res) => {
  try {
    const orgId = res.locals.orgId;

    // Validate request body
    const validatedData = insertSensorTemplateSchema.parse(req.body);

    // Verify templateId uniqueness within org
    const existing = await db
      .select()
      .from(sensorTemplates)
      .where(
        and(
          eq(sensorTemplates.orgId, orgId),
          eq(sensorTemplates.templateId, validatedData.templateId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({
        error: "Template ID already exists for this organization",
        templateId: validatedData.templateId,
      });
    }

    // Create template
    const [newTemplate] = await db
      .insert(sensorTemplates)
      .values({
        ...validatedData,
        orgId, // Set to current org
        isSystemDefault: false, // User templates are never system defaults
        createdBy: res.locals.userId || "unknown",
      })
      .returning();

    res.status(201).json(newTemplate);
  } catch (error) {
    logger.error("[SensorTemplates] Error creating template:", undefined, error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }
    res.status(500).json({
      error: "Failed to create sensor template",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * PUT /api/sensor-templates/:id
 * Update an existing sensor template (only org-specific templates, not system templates)
 *
 * IMMUTABILITY: The templateId field cannot be changed after creation to maintain
 * bundle integrity (bundles reference templates by templateId). Attempts to change
 * templateId will be rejected with 400. Requests including templateId with the same
 * value are silently accepted (Zod strips the field).
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = res.locals.orgId;

    // Check template exists and belongs to org (not system template)
    const [existing] = await db
      .select()
      .from(sensorTemplates)
      .where(
        and(
          eq(sensorTemplates.id, id),
          eq(sensorTemplates.orgId, orgId), // Must belong to org
          eq(sensorTemplates.isSystemDefault, false) // Cannot update system templates
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({
        error: "Sensor template not found or cannot be modified (system templates are read-only)",
      });
    }

    // Validate request body (partial update allowed)
    const updateSchema = insertSensorTemplateSchema.partial().omit({ templateId: true });
    const validatedData = updateSchema.parse(req.body);

    // Reject attempts to change templateId (immutable after creation)
    if (req.body.templateId && req.body.templateId !== existing.templateId) {
      return res.status(400).json({
        error: "Template ID cannot be changed after creation (referenced by bundles)",
        message: "Template ID is immutable to maintain bundle integrity",
      });
    }

    // Update template
    const [updatedTemplate] = await db
      .update(sensorTemplates)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(sensorTemplates.id, id))
      .returning();

    res.json(updatedTemplate);
  } catch (error) {
    logger.error(`[SensorTemplates] Error updating template ${req.params.id}:`, undefined, error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }
    res.status(500).json({
      error: "Failed to update sensor template",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * DELETE /api/sensor-templates/:id
 * Delete a sensor template (only org-specific templates, not system templates)
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = res.locals.orgId;

    // Check template exists and belongs to org (not system template)
    const [existing] = await db
      .select()
      .from(sensorTemplates)
      .where(
        and(
          eq(sensorTemplates.id, id),
          eq(sensorTemplates.orgId, orgId),
          eq(sensorTemplates.isSystemDefault, false)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({
        error: "Sensor template not found or cannot be deleted (system templates are protected)",
      });
    }

    // Check if template is referenced by any bundles
    const referencingBundles = await db
      .select()
      .from(sensorBundles)
      .where(
        and(
          or(isNull(sensorBundles.orgId), eq(sensorBundles.orgId, orgId)),
          // Check if this template's templateId appears in any bundle's templateIds array
          // Note: This requires raw SQL for array containment check
          sql`${existing.templateId} = ANY(${sensorBundles.templateIds})`
        )
      );

    if (referencingBundles.length > 0) {
      const bundleNames = referencingBundles.map((b) => b.name).join(", ");
      return res.status(409).json({
        error: "Template is referenced by sensor bundles and cannot be deleted",
        referencingBundles: referencingBundles.map((b) => ({
          id: b.id,
          bundleId: b.bundleId,
          name: b.name,
        })),
        message: `Remove template from these bundles first: ${bundleNames}`,
      });
    }

    // Delete template
    await db.delete(sensorTemplates).where(eq(sensorTemplates.id, id));

    res.status(204).send();
  } catch (error) {
    logger.error(`[SensorTemplates] Error deleting template ${req.params.id}:`, undefined, error);
    res.status(500).json({
      error: "Failed to delete sensor template",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/sensor-templates/:id/copy
 * Copy an existing template (system or org-specific) to create a new org-specific template
 *
 * This endpoint enables the "save copy" flow, allowing users to:
 * 1. Clone system templates to customize them for their org
 * 2. Duplicate existing org templates
 *
 * The new template will:
 * - Be owned by the current org (orgId = res.locals.orgId)
 * - Have isSystemDefault = false (always user-created)
 * - Get a new unique templateId based on the original (e.g., "vibration-v2" -> "vibration-v2-copy-1")
 * - Have a prefixed name (e.g., "Copy of [original name]")
 */
router.post("/:id/copy", async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = res.locals.orgId;

    // Fetch source template (must be either system template or belong to org)
    const [sourceTemplate] = await db
      .select()
      .from(sensorTemplates)
      .where(
        and(
          eq(sensorTemplates.id, id),
          or(isNull(sensorTemplates.orgId), eq(sensorTemplates.orgId, orgId))
        )
      )
      .limit(1);

    if (!sourceTemplate) {
      return res.status(404).json({ error: "Source template not found" });
    }

    // Generate unique templateId by appending suffix
    let newTemplateId = `${sourceTemplate.templateId}-copy`;
    let suffix = 1;

    // Check for conflicts and increment suffix until unique
    while (true) {
      const existing = await db
        .select()
        .from(sensorTemplates)
        .where(and(eq(sensorTemplates.orgId, orgId), eq(sensorTemplates.templateId, newTemplateId)))
        .limit(1);

      if (existing.length === 0) {
        break;
      }

      suffix++;
      newTemplateId = `${sourceTemplate.templateId}-copy-${suffix}`;
    }

    // Generate new name with "Copy of" prefix
    const newName = `Copy of ${sourceTemplate.name}`;

    // Clone mutable fields from source template
    const [newTemplate] = await db
      .insert(sensorTemplates)
      // @ts-ignore -- bulk-silence
      .values({
        templateId: newTemplateId,
        name: newName,
        // @ts-ignore -- bulk-silence
        description: sourceTemplate.description,
        kind: sourceTemplate.kind,
        unit: sourceTemplate.unit,
        // @ts-ignore -- bulk-silence
        minValue: sourceTemplate.minValue,
        // @ts-ignore -- bulk-silence
        maxValue: sourceTemplate.maxValue,
        // @ts-ignore -- bulk-silence
        criticalLowThreshold: sourceTemplate.criticalLowThreshold,
        // @ts-ignore -- bulk-silence
        warningLowThreshold: sourceTemplate.warningLowThreshold,
        // @ts-ignore -- bulk-silence
        normalLowThreshold: sourceTemplate.normalLowThreshold,
        // @ts-ignore -- bulk-silence
        normalHighThreshold: sourceTemplate.normalHighThreshold,
        // @ts-ignore -- bulk-silence
        warningHighThreshold: sourceTemplate.warningHighThreshold,
        // @ts-ignore -- bulk-silence
        criticalHighThreshold: sourceTemplate.criticalHighThreshold,
        // @ts-ignore -- bulk-silence
        samplingIntervalSeconds: sourceTemplate.samplingIntervalSeconds,
        equipmentTypes: sourceTemplate.equipmentTypes,
        // @ts-ignore -- bulk-silence
        tags: sourceTemplate.tags,
        orgId, // Set to current org
        isSystemDefault: false, // Always false for copies
        createdBy: res.locals.userId || "unknown",
      })
      .returning();

    res.status(201).json(newTemplate);
  } catch (error) {
    logger.error(`[SensorTemplates] Error copying template ${req.params.id}:`, undefined, error);
    res.status(500).json({
      error: "Failed to copy sensor template",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
