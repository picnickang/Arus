import type { Request, Response, NextFunction } from "express";
import { dbDevicesStorage } from "../repositories";
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

export async function verifyDeviceOwnership(deviceId: string, orgId: string): Promise<void> {
  try {
    const device = await dbDevicesStorage.getDevice(deviceId);

    if (!device) {
      throw new OrgIdValidationError(`Device not found: ${deviceId}`, "DEVICE_NOT_FOUND", 404);
    }

    if (device.orgId !== orgId) {
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

    console.error(`[SECURITY] Failed to verify device ownership for ${deviceId}:`, error);
    throw new OrgIdValidationError(
      "Failed to verify device ownership",
      "OWNERSHIP_VERIFICATION_FAILED",
      500
    );
  }
}

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

    console.error(`[SECURITY] Failed to verify equipment ownership for ${equipmentId}:`, error);
    throw new OrgIdValidationError(
      "Failed to verify equipment ownership",
      "OWNERSHIP_VERIFICATION_FAILED",
      500
    );
  }
}

export async function validateMqttClientOrg(
  mqttClientId: string,
  claimedOrgId: string
): Promise<string> {
  try {
    const devices = await dbDevicesStorage.getDevices(claimedOrgId);
    const device = (devices as any[]).find((d: any) => d.mqttClientId === mqttClientId);

    if (!device) {
      console.error(`[SECURITY] Unregistered MQTT client attempted connection: ${mqttClientId}`);
      throw new OrgIdValidationError(
        `MQTT client not registered: ${mqttClientId}`,
        "MQTT_CLIENT_NOT_REGISTERED",
        403
      );
    }

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

export async function validateJ1939Device(deviceId: string, orgId: string): Promise<void> {
  await verifyEquipmentOwnership(deviceId, orgId);
}

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

export function requireValidOrgId(
  options: {
    verifyDeviceId?: boolean;
    verifyEquipmentId?: boolean;
  } = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = extractOrgIdFromHeader(req);

      (req as OrgRequest).orgId = orgId;

      if (options.verifyDeviceId && req.body?.deviceId) {
        await verifyDeviceOwnership(req.body.deviceId, orgId);
      }

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
