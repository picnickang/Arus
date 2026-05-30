/**
 * Crew Admin Domain (cloud-only)
 * DDD Modular Monolith with Hexagonal Architecture.
 *
 * Admin "Crew Management": roles + per-role dashboard configs, user
 * vessel/department assignments, and login credential admin.
 */

export * from "./domain";
export * from "./application";
export * from "./infrastructure";
export * from "./interfaces";
export { crewAdminService } from "./service";
