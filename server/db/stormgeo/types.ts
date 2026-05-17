/**
 * StormGeo - Types
 */

import type {
  weatherCache,
  stormgeoSettings,
} from "@shared/schema-runtime";

export type StormgeoSetting = typeof stormgeoSettings.$inferSelect;
export type InsertStormgeoSetting = typeof stormgeoSettings.$inferInsert;

export type {
  StormgeoSnapshot,
  InsertStormgeoSnapshot,
  StormgeoImportHistory,
  InsertStormgeoImportHistory,
} from "@shared/schema";

export type WeatherCache = typeof weatherCache.$inferSelect;
export type InsertWeatherCache = Omit<WeatherCache, "id" | "createdAt" | "updatedAt">;
