import type { Request, Response, NextFunction } from "express";

export function isLowBandwidth(req: Request): boolean {
  return (
    req.headers["x-bandwidth-mode"] === "low" || req.headers["x-bandwidth-mode"] === "satellite"
  );
}

export function compactResponse(data: unknown, maxStringLength = 100): unknown {
  if (data === null || data === undefined) {
    return undefined;
  }
  if (typeof data === "number" || typeof data === "boolean") {
    return data;
  }

  if (typeof data === "string") {
    if (data.length > maxStringLength) {
      return `${data.substring(0, maxStringLength)}\u2026`;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data
      .map((item) => compactResponse(item, maxStringLength))
      .filter((v) => v !== undefined);
  }

  if (typeof data === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (
        [
          "description",
          "notes",
          "details",
          "metadata",
          "supportingSignals",
          "relatedProcedures",
          "hyperparameters",
          "featureImportance",
          "performanceMetrics",
          "trainingData",
          "validationMetrics",
        ].includes(key)
      ) {
        if (typeof value === "string" && value.length > 50) {
          result[key] = `${value.substring(0, 50)}...`;
          continue;
        }
        if (typeof value === "object") {
          continue;
        }
      }

      const compacted = compactResponse(value, maxStringLength);
      if (compacted !== undefined) {
        result[key] = compacted;
      }
    }

    return result;
  }

  return data;
}

export function bandwidthAwareMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!isLowBandwidth(req)) {
    return next();
  }

  if (!req.query.pageSize) {
    (req.query as any).pageSize = "10";
  }

  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const compacted = compactResponse(body);
    res.setHeader("X-Response-Mode", "compact");
    return originalJson(compacted);
  };

  next();
}

export default bandwidthAwareMiddleware;
