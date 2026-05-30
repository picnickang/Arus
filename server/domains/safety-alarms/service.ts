/**
 * Safety Alarms Domain - Composed Service Instance
 * Wires the infrastructure adapter into the application service.
 */

import { SafetyAlarmApplicationService } from "./application/safety-alarm-service";
import { safetyAlarmRepository } from "./infrastructure/safety-alarm-repository-adapter";

export const safetyAlarmService = new SafetyAlarmApplicationService(safetyAlarmRepository);

export { AlarmValidationError } from "./application/safety-alarm-service";
