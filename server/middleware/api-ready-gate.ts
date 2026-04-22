/**
 * API Readiness Gate Middleware
 * Returns 503 until application is fully initialized
 */
import type { Request, Response, NextFunction } from "express";

let apiReady = false;

export const setApiReady = (ready: boolean) => {
  apiReady = ready;
};

export function apiReadyGate(req: Request, res: Response, next: NextFunction) {
  if (apiReady) {
    return next();
  }
  return res.status(503).json({ status: "initializing" });
}
