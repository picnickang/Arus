import { Router } from "express";

const router = Router();

router.get("/health", async (_req, res) => {
  try {
    const { mqttReliableSync } = await import("../mqtt-reliable-sync");
    const healthStatus = mqttReliableSync.getHealthStatus();
    const metrics = mqttReliableSync.getMetrics();

    res.json({
      service: "MQTT Reliable Sync Service",
      status: healthStatus.status === "connected" ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      mqtt: healthStatus,
      detailedMetrics: metrics,
    });
  } catch (error) {
    res.status(500).json({
      service: "MQTT Reliable Sync Service",
      message: "Failed to get MQTT health status",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export { router as mqttHealthRouter };
