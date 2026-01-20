/**
 * HMAC Validation Middleware
 * Extracted from routes.ts for modularization
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

export async function validateHMAC(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await storage.getSettings();
    if (!settings.hmacRequired) {
      return next();
    }

    let equipmentId = req.body?.equipmentId || req.headers["x-equipment-id"];

    if (!equipmentId && req.body?.rows && Array.isArray(req.body.rows) && req.body.rows.length > 0) {
      equipmentId = req.body.rows[0]?.src;
    }

    if (!equipmentId && req.body?.csvData && typeof req.body.csvData === "string") {
      const csvLines = req.body.csvData.trim().split("\n");
      if (csvLines.length > 1) {
        const headerLine = csvLines[0];
        const dataLine = csvLines[1];
        const headers = headerLine.split(",").map((h: string) => h.trim());
        const values = dataLine.split(",").map((v: string) => v.trim());
        const srcIndex = headers.indexOf("src");
        if (srcIndex >= 0 && values[srcIndex]) {
          equipmentId = values[srcIndex];
        }
      }
    }

    if (!equipmentId) {
      return res.status(400).json({
        error: "Equipment ID required for HMAC validation",
        code: "MISSING_EQUIPMENT_ID",
      });
    }

    const device = await storage.getDevice(equipmentId);
    if (!device || !device.hmacKey) {
      return res.status(401).json({
        error: "Device not found or HMAC key not configured",
        code: "HMAC_KEY_MISSING",
      });
    }

    const signature = req.headers["x-hmac-signature"] || 
      (req.headers["authorization"] as string)?.replace("HMAC ", "");
    if (!signature) {
      return res.status(401).json({
        error: "HMAC signature required in X-HMAC-Signature header or Authorization header",
        code: "MISSING_HMAC_SIGNATURE",
      });
    }

    const payload = JSON.stringify(req.body);
    const expectedSignature = createHmac("sha256", device.hmacKey).update(payload).digest("hex");

    const providedSignature = (signature as string).toLowerCase().replace(/^sha256=/, "");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const providedBuffer = Buffer.from(providedSignature, "hex");

    if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
      return res.status(401).json({
        error: "Invalid HMAC signature",
        code: "INVALID_HMAC_SIGNATURE",
      });
    }

    next();
  } catch (error) {
    console.error("HMAC validation error:", error);
    res.status(500).json({
      error: "HMAC validation failed",
      code: "HMAC_VALIDATION_ERROR",
    });
  }
}
