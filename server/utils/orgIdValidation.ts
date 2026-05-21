import type { Request, Response, NextFunction } from "express";
import { dbDevicesStorage } from "../repositories";
import { equipmentService } from "../domains/equipment/service";
import { createLogger } from "../lib/structured-logger";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
const logger = createLogger("Utils:OrgIdValidation");

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

export function extractOrgIdFromHeader(
  req: Request | { headers: Record<string, string | string[] | undefined> }
): string {
  const rawHeader = req.headers["x-org-id"];
  const suppliedOrgId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  if (suppliedOrgId && suppliedOrgId.trim() !== DEFAULT_ORG_ID) {
    throw new OrgIdValidationError(
      "Forbidden: Cannot select a different organization in single-tenant mode",
      "ORG_CONTEXT_FORBIDDEN",
      403
    );
  }

  return DEFAULT_ORG_ID;
}


export async function verifyDeviceOwnership(deviceId: string, orgId: string): Promise<void> {
  try {
    const device = await dbDevicesStorage.getDevice(deviceId);

    if (!device) {
      throw new OrgIdValidationError(`Device not found: ${deviceId}`, "DEVICE_NOT_FOUND", 404);
    }

    if (device.orgId !== orgId) {
      logger.error(`[SECURITY] Device ${deviceId} attempted to send data to unauthorized org ${orgId} (belongs to ${device.orgId})`);
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

    logger.error(`[SECURITY] Failed to verify device ownership for ${deviceId}:`, undefined, error);
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
      logger.error(`[SECURITY] Equipment ${equipmentId} org mismatch: expected ${orgId}, got ${equipment.orgId}`);
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

    logger.error(`[SECURITY] Failed to verify equipment ownership for ${equipmentId}:`, undefined, error);
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
    const device = (devices as object as Array<{ mqttClientId?: string; deviceId?: string }>).find((d) => d.mqttClientId === mqttClientId);

    if (!device) {
      logger.error(`[SECURITY] Unregistered MQTT client attempted connection: ${mqttClientId}`);
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

    logger.error(`[SECURITY] MQTT client validation failed for ${mqttClientId}:`, undefined, error);
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
    logger.error(`[SECURITY] Import org mismatch: data claims ${importOrgId}, authenticated as ${authenticatedOrgId}`);
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

      logger.error("[SECURITY] Unexpected error in org ID validation:", undefined, error);
      return res.status(500).json({
        error: "Internal server error during organization validation",
        code: "ORG_VALIDATION_ERROR",
      });
    }
  };
}
