/**
 * Domain Router Registry - Centralized domain router registration
 * Extracted from routes.ts for modularization
 *
 * This file keeps the public domain router import path stable while the
 * declarative router inventory lives in smaller config modules.
 */

import type { Express } from "express";
import { createLogger } from "../lib/structured-logger";
import { coreDomainRouters } from "./domain-router-config-core";
import { domainRouteRouters } from "./domain-router-config-domain-routes";
import { mountedDomainRouters } from "./domain-router-config-mounted-routes";
import type { DomainRouterConfig } from "./domain-router-config-types";

const logger = createLogger("Routes:DomainRouterRegistry");

export type { DomainRouterConfig } from "./domain-router-config-types";

/**
 * CANONICAL PATTERN — Two registration modes:
 *
 * 1. registerFn mode — calls mod[functionName](app, deps).
 * 2. Router-mount mode — does app.use(mountPath, ...middleware, router).
 */
export const domainRouters: DomainRouterConfig[] = [
  ...coreDomainRouters,
  ...domainRouteRouters,
  ...mountedDomainRouters,
];

/**
 * Register all domain routers.
 *
 * Two registration modes:
 * - registerFn mode (default): calls mod[functionName](app, deps)
 * - router-mount mode (mountPath set): does app.use(mountPath, ...middleware, mod[functionName])
 */
export async function registerAllDomainRouters(app: Express): Promise<void> {
  logger.info("→ Registering domain routers...");

  for (const config of domainRouters) {
    try {
      const mod = await import(config.importPath);
      const target = mod[config.functionName];

      if (!target) {
        logger.error(
          `[Domain Registry] ${config.name}: ${config.functionName} not found in ${config.importPath}`
        );
        continue;
      }

      const deps = config.getDeps();

      if (config.mountPath) {
        const middleware = (config.middlewareKeys ?? [])
          .map((k) => deps[k])
          .filter(Boolean) as import("express").RequestHandler[];
        app.use(config.mountPath, ...middleware, target as import("express").RequestHandler);
      } else {
        if (typeof target !== "function") {
          logger.error(
            `[Domain Registry] ${config.name}: ${config.functionName} is not a function`
          );
          continue;
        }
        await target(app, deps);
      }
    } catch (error) {
      logger.error(`[Domain Registry] Failed to register ${config.name}:`, undefined, error);
    }
  }

  logger.info(`✓ Domain routers registered (${domainRouters.length} modules)`);
}
