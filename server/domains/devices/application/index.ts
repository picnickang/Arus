/**
 * Devices Application Layer - Dependency Injection Composition Root
 */

import { DeviceService } from "./device-service";
import { deviceRepository } from "../infrastructure/device-repository-adapter";

export const deviceService = new DeviceService(deviceRepository);

export { DeviceService } from "./device-service";
