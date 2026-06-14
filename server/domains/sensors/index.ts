/**
 * Sensors Domain (sensor calibration)
 * DDD Modular Monolith with Hexagonal Architecture
 *
 * Layers: domain/ application/ infrastructure/ interfaces/
 */
import type { Express } from "express";
import { sensorCalibrationRouter } from "./interfaces";

export * from "./domain";
export * from "./application";
export * from "./infrastructure";
export { sensorCalibrationRouter } from "./interfaces";

export function registerSensorCalibrationRoutes(app: Express) {
  app.use("/api/sensors/calibration", sensorCalibrationRouter);
}
