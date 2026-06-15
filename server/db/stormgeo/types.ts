/**
 * StormGeo - Types
 */

import type { weatherCache } from "@shared/schema-runtime";

export type WeatherCache = typeof weatherCache.$inferSelect;
export type InsertWeatherCache = Omit<WeatherCache, "id" | "createdAt" | "updatedAt">;
