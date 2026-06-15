/**
 * STCW - Types
 */

import { crewRestSheet, crewRestDay } from "@shared/schema-runtime";
export type InsertCrewRestSheet = typeof crewRestSheet.$inferInsert;
export type InsertCrewRestDay = typeof crewRestDay.$inferInsert;
