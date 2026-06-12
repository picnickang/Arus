import { apiRequest } from "../queryClient";
import type { PdmScoreLog } from "@shared/schema";

export async function fetchPdmScores(equipmentId?: string): Promise<PdmScoreLog[]> {
  const url = equipmentId ? `/api/pdm/scores?equipmentId=${equipmentId}` : "/api/pdm/scores";
  return apiRequest("GET", url);
}
