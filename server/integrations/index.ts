/**
 * External Integrations Module
 *
 * This module provides integrations with external hardware and services.
 *
 * DESIGN RULE: All integrations MUST plug into existing telemetry & track
 * schemas, not create parallel systems. Use source fields to distinguish
 * data origin (e.g., 'fmcc', 'gps', 'mqtt').
 */

export * from "./aquametro-fmcc";
export * from "./fmcc-types";
export * from "./fmcc-polling-service";
