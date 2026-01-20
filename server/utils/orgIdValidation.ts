/**
 * Unified Organization ID Validation
 *
 * Enforces server-side organization ID verification across all telemetry ingestion paths
 * SECURITY: Never trust client-provided organization IDs from request body or metadata
 *
 * Features:
 * - Server-side validation (header-only)
 * - Device/equipment ownership verification
 * - Consistent error handling
 * - Multi-tenant isolation enforcement
 */

import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { equipmentService } from "../domains/equipment/service";

export interface OrgRequest extends Request {
  orgId: string;
}

export class OrgIdValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "OrgIdValidationError";
  }
}

/**
 * Extract and validate organization ID from request headers (NEVER from body/metadata)
 * This is the primary method all ingestion paths should use
 *
 * @throws {OrgIdValidationError} if orgId is missing, invalid, or malformed
 */
export function extractOrgIdFromHeader(req: Request | { headers: Record<string, string | string[] | undefined> }): string {
  const orgId = req.headers["x-org-id"] as string | undefined;

  if (!orgId) {
    throw new OrgIdValidationError(
      "Organization ID required: x-org-id header must be provided",
      "MISSING_ORG_ID",
      400
    );
  }

  if (typeof orgId !== "string" || orgId.trim() === "") {
    throw new OrgIdValidationError(
      "Invalid organization ID: must be a non-empty string",
      "INVALID_ORG_ID",
      400
    );
  }

  // Validate format (alphanumeric, hyphens, underscores only)
  const orgIdPattern = /^[a-zA-Z0-9_-]+$/;
  if (!orgIdPattern.test(orgId.trim())) {
    throw new OrgIdValidationError(
      "Invalid organization ID format: only alphanumeric characters, hyphens, and underscores allowed",
      "INVALID_ORG_ID_FORMAT",
      400
    );
  }

  return orgId.trim();
}

/**
 * Verify that a device belongs to the specified organization
 * Used by MQTT and J1939 ingestion to prevent cross-tenant data injection
 *
 * @throws {OrgIdValidationError} if device doesn't belong to org
 */
export async function verifyDeviceOwnership(deviceId: string, orgId: string): Promise<void> {
  try {
    const device = await storage.getDeviceById(deviceId);

    if (!device) {
      throw new OrgIdValidationError(`Device not found: ${deviceId}`, "DEVICE_NOT_FOUND", 404);
    }

    if (device.orgId !== orgId) {
      // This is a critical security violation - device trying to inject data into different org
      console.error(
        `[SECURITY] Device ${deviceId} attempted to send data to unauthorized org ${orgId} (belongs to ${device.orgId})`
      );
      throw new OrgIdValidationError(
        "Forbidden: Device does not belong to specified organization",
        "ORG_ACCESS_DENIED",
        403
      );
    }
  } catch (error) {
    if (error instanceof OrgIdValidationError) {
      throw error;
    }

    // Fail-closed: if we can't verify ownership, reject the request
    console.error(`[SECURITY] Failed to verify device ownership for ${deviceId}:`, error);
    throw new OrgIdValidationError(
      "Failed to verify device ownership",
      "OWNERSHIP_VERIFICATION_FAILED",
      500
    );
  }
}

/**
 * Verify that equipment belongs to the specified organization
 * Used by HTTP telemetry endpoints to prevent cross-tenant data injection
 *
 * @throws {OrgIdValidationError} if equipment doesn't belong to org
 */
export async function verifyEquipmentOwnership(equipmentId: string, orgId: string): Promise<void> {
  try {
    const equipment = await equipmentService.getEquipmentById(equipmentId, orgId);

    if (!equipment) {
      throw new OrgIdValidationError(
        `Equipment not found or access denied: ${equipmentId}`,
        "EQUIPMENT_NOT_FOUND",
        404
      );
    }

    // Double-check org ownership (defense in depth)
    if (equipment.orgId !== orgId) {
      console.error(
        `[SECURITY] Equipment ${equipmentId} org mismatch: expected ${orgId}, got ${equipment.orgId}`
      );
      throw new OrgIdValidationError(
        "Forbidden: Equipment does not belong to specified organization",
        "ORG_ACCESS_DENIED",
        403
      );
    }
  } catch (error) {
    if (error instanceof OrgIdValidationError) {
      throw error;
    }

    // Fail-closed: if we can't verify ownership, reject the request
    console.error(`[SECURITY] Failed to verify equipment ownership for ${equipmentId}:`, error);
    throw new OrgIdValidationError(
      "Failed to verify equipment ownership",
      "OWNERSHIP_VERIFICATION_FAILED",
      500
    );
  }
}

/**
 * MQTT-specific validation: Extract orgId from MQTT client authentication
 * Validates that MQTT client ID is registered and belongs to the claimed organization
 *
 * @param mqttClientId - MQTT client identifier
 * @param claimedOrgId - Organization ID from x-org-id header or device registry
 * @throws {OrgIdValidationError} if validation fails
 */
export async function validateMqttClientOrg(
  mqttClientId: string,
  claimedOrgId: string
): Promise<string> {
  try {
    // Look up MQTT device registration
    const mqttDevices = await storage.getMqttDevices(claimedOrgId);
    const device = mqttDevices.find((d) => d.mqttClientId === mqttClientId);

    if (!device) {
      console.error(`[SECURITY] Unregistered MQTT client attempted connection: ${mqttClientId}`);
      throw new OrgIdValidationError(
        `MQTT client not registered: ${mqttClientId}`,
        "MQTT_CLIENT_NOT_REGISTERED",
        403
      );
    }

    // Verify the device's registered org matches claimed org
    if (device.deviceId) {
      await verifyDeviceOwnership(device.deviceId, claimedOrgId);
    }

    return claimedOrgId;
  } catch (error) {
    if (error instanceof OrgIdValidationError) {
      throw error;
    }

    console.error(`[SECURITY] MQTT client validation failed for ${mqttClientId}:`, error);
    throw new OrgIdValidationError("MQTT client validation failed", "MQTT_VALIDATION_FAILED", 500);
  }
}

/**
 * J1939-specific validation: Verify J1939 device configuration and org ownership
 *
 * @param deviceId - J1939 device/equipment ID
 * @param orgId - Organization ID from authentication
 * @throws {OrgIdValidationError} if validation fails
 */
export async function validateJ1939Device(deviceId: string, orgId: string): Promise<void> {
  // J1939 devices are typically registered as equipment in ARUS
  await verifyEquipmentOwnership(deviceId, orgId);
}

/**
 * Manual import validation: Ensure bulk upload data belongs to authenticated org
 * Validates each row/entry to prevent cross-tenant contamination
 *
 * @param importOrgId - Organization ID from import data (if present)
 * @param authenticatedOrgId - Organization ID from x-org-id header
 * @throws {OrgIdValidationError} if organizations don't match
 */
export function validateImportOrgId(
  importOrgId: string | undefined,
  authenticatedOrgId: string
): void {
  if (importOrgId && importOrgId !== authenticatedOrgId) {
    console.error(
      `[SECURITY] Import org mismatch: data claims ${importOrgId}, authenticated as ${authenticatedOrgId}`
    );
    throw new OrgIdValidationError(
      "Forbidden: Cannot import data for a different organization",
      "IMPORT_ORG_MISMATCH",
      403
    );
  }
}

/**
 * Express middleware factory for org ID validation
 * Use this for routes that require organization context
 */
export function requireValidOrgId(
  options: {
    verifyDeviceId?: boolean;
    verifyEquipmentId?: boolean;
  } = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract and validate org ID from header
      const orgId = extractOrgIdFromHeader(req);

      // Attach to request for downstream use
      (req as OrgRequest).orgId = orgId;

      // Optional: verify device ownership
      if (options.verifyDeviceId && req.body?.deviceId) {
        await verifyDeviceOwnership(req.body.deviceId, orgId);
      }

      // Optional: verify equipment ownership
      if (options.verifyEquipmentId && req.body?.equipmentId) {
        await verifyEquipmentOwnership(req.body.equipmentId, orgId);
      }

      next();
    } catch (error) {
      if (error instanceof OrgIdValidationError) {
        return res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
        });
      }

      console.error("[SECURITY] Unexpected error in org ID validation:", error);
      return res.status(500).json({
        error: "Internal server error during organization validation",
        code: "ORG_VALIDATION_ERROR",
      });
    }
  };
}
