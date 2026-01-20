/**
 * Diagnostics Routes - Configuration Endpoints
 */

import { Router, Request, Response } from "express";

export function registerConfigRoutes(router: Router) {
  router.get("/config", (req: Request, res: Response) => {
    const config = {
      telemetry: {
        batchIntervalMs: Number.parseInt(process.env.TELEMETRY_BATCH_INTERVAL_MS || '500'),
        maxBufferSize: Number.parseInt(process.env.TELEMETRY_MAX_BUFFER_SIZE || '10000'),
        evictionPercent: Number.parseFloat(process.env.TELEMETRY_EVICTION_PERCENT || '0.1'),
        maxRetries: Number.parseInt(process.env.TELEMETRY_MAX_RETRIES || '3'),
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        deploymentMode: process.env.DEPLOYMENT_MODE || 'cloud',
      },
      features: {
        dualDatabase: process.env.ENABLE_DUAL_DB === 'true',
        mlPredictions: process.env.ENABLE_ML === 'true',
        fmccIntegration: !!process.env.FMCC_API_URL,
      },
      timestamp: new Date().toISOString(),
    };
    res.json(config);
  });
}
