/**
 * STCW Dashboard Data Fetcher - Crew rest data retrieval
 */

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Scheduler:StcwDashboard:DataFetcher");
import { dbCrewStorage, dbStcwStorage } from "../../repositories";
import { withSpan } from "../../utils/request-spans";
import type { RestDay } from "../../stcw-compliance";
import type { CrewRestData } from "./types";

export function getDateRange(days: number): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

export async function getCrewRestDataForVessel(
  orgId: string,
  vesselId: string,
  startDate: string,
  endDate: string
): Promise<Map<string, CrewRestData>> {
  const crewDataMap = new Map<string, CrewRestData>();

  try {
    const crewList = await withSpan("db", "getCrew", () => dbCrewStorage.getCrew(orgId), {
      vesselId,
    });
    const vesselCrew = crewList.filter((c) => c.vesselId === vesselId);

    for (const crew of vesselCrew) {
      const restData = await dbStcwStorage.getCrewRestRange(crew.id, startDate, endDate);

      const restDays: RestDay[] = restData.days
        .filter((day) => {
          return [
            day.h0,
            day.h1,
            day.h2,
            day.h3,
            day.h4,
            day.h5,
            day.h6,
            day.h7,
            day.h8,
            day.h9,
            day.h10,
            day.h11,
            day.h12,
            day.h13,
            day.h14,
            day.h15,
            day.h16,
            day.h17,
            day.h18,
            day.h19,
            day.h20,
            day.h21,
            day.h22,
            day.h23,
          ].some((h) => h !== null && h !== undefined);
        })
        .map((day) => ({
          date: day.date,
          h0: day.h0 ?? 0,
          h1: day.h1 ?? 0,
          h2: day.h2 ?? 0,
          h3: day.h3 ?? 0,
          h4: day.h4 ?? 0,
          h5: day.h5 ?? 0,
          h6: day.h6 ?? 0,
          h7: day.h7 ?? 0,
          h8: day.h8 ?? 0,
          h9: day.h9 ?? 0,
          h10: day.h10 ?? 0,
          h11: day.h11 ?? 0,
          h12: day.h12 ?? 0,
          h13: day.h13 ?? 0,
          h14: day.h14 ?? 0,
          h15: day.h15 ?? 0,
          h16: day.h16 ?? 0,
          h17: day.h17 ?? 0,
          h18: day.h18 ?? 0,
          h19: day.h19 ?? 0,
          h20: day.h20 ?? 0,
          h21: day.h21 ?? 0,
          h22: day.h22 ?? 0,
          h23: day.h23 ?? 0,
        }));

      crewDataMap.set(crew.id, {
        crewId: crew.id,
        crewName: crew.name,
        days: restDays,
      });
    }
  } catch (error) {
    logger.error(`Error fetching crew rest data for vessel ${vesselId}:`, undefined, error);
  }

  return crewDataMap;
}
