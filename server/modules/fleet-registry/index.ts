// @ts-nocheck
import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Modules:FleetRegistry:Index");
import type { Express } from "express";
import type { RateLimiters } from "./interfaces/vessel.routes";
import { FleetRegistryService } from "./application/fleet-registry.service";
import {
  VesselRepositoryAdapter,
  PortCallRepositoryAdapter,
  DrydockWindowRepositoryAdapter,
} from "./infrastructure/vessel-repository.adapter";
import { VesselOperationsAdapter } from "./infrastructure/vessel-operations.adapter";
import { EventPublisherAdapter } from "./infrastructure/event-publisher.adapter";
import { registerFleetRegistryVesselRoutes } from "./interfaces/vessel.routes";

const vesselRepo = new VesselRepositoryAdapter();
const portCallRepo = new PortCallRepositoryAdapter();
const drydockRepo = new DrydockWindowRepositoryAdapter();
const vesselOps = new VesselOperationsAdapter();
const eventPublisher = new EventPublisherAdapter();

export const fleetRegistryService = new FleetRegistryService(
  vesselRepo,
  portCallRepo,
  drydockRepo,
  vesselOps,
  eventPublisher
);

export function registerFleetRegistryRoutes(app: Express, rateLimiters: RateLimiters) {
  registerFleetRegistryVesselRoutes(app, fleetRegistryService, rateLimiters);
  logger.info("[FleetRegistry] Hexagonal module routes registered");
}

export { FleetRegistryService } from "./application/fleet-registry.service";
export type { RateLimiters } from "./interfaces/vessel.routes";
export type {
  VesselRepositoryPort,
  PortCallRepositoryPort,
  DrydockWindowRepositoryPort,
  VesselOperationsPort,
  EventPublisherPort,
} from "./domain/ports";
