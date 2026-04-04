import type { Express } from "express";
import { sensorCalibrationRouter } from "./routes";

export function registerSensorCalibrationRoutes(app: Express) {
  app.use("/api/sensors/calibration", sensorCalibrationRouter);
}
