/**
 * Sensors Application Layer - Dependency Injection Composition Root
 */

import { SensorCalibrationService } from "./sensor-calibration-service";
import { sensorCalibrationRepository } from "../infrastructure/sensor-calibration-repository-adapter";

export const sensorCalibrationService = new SensorCalibrationService(sensorCalibrationRepository);

export {
  SensorCalibrationService,
  SensorNotFoundError,
} from "./sensor-calibration-service";
