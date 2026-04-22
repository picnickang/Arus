/**
 * STCW - Types
 */

export type {
  SelectCrewRestSheet as CrewRestSheet,
  SelectCrewRestDay as CrewRestDay,
} from "@shared/schema-runtime";
import { crewRestSheet, crewRestDay } from "@shared/schema-runtime";
export type InsertCrewRestSheet = typeof crewRestSheet.$inferInsert;
export type InsertCrewRestDay = typeof crewRestDay.$inferInsert;
