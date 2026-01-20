/**
 * Validation Utilities
 * Shared validation functions for route handlers
 */

import type { Response } from "express";

const UUID_REGEX = /^[0-9a-f-]{36}$/i;

/**
 * Validate UUID format and send error response if invalid
 * @returns true if valid, false if invalid (and response is sent)
 */
export function validateUUID(id: string, res: Response): boolean {
  if (!id || !UUID_REGEX.test(id)) {
    res.status(400).json({ error: "Invalid ID format" });
    return false;
  }
  return true;
}

/**
 * Check if string is a valid UUID format
 */
export function isValidUUID(id: string): boolean {
  return Boolean(id && UUID_REGEX.test(id));
}
