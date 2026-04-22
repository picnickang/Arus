import type { Request, Response } from "express";

export interface RateLimitMiddleware {
  generalApiRateLimit: (req: Request, res: Response, next: () => void) => void;
  writeOperationRateLimit: (req: Request, res: Response, next: () => void) => void;
}

export type RoleMiddleware = (req: Request, res: Response, next: () => void) => void;
