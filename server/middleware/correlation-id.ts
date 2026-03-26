import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

const REQUEST_ID_HEADER = "X-Request-Id";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers[REQUEST_ID_HEADER.toLowerCase()] as string;
  const requestId = existingId || randomUUID();

  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  next();
}

export function getRequestId(req: Request): string {
  return req.requestId || "unknown";
}

export default correlationIdMiddleware;
