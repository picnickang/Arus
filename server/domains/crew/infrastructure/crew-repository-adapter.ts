/**
 * Crew Repository Adapter
 * Implements ICrewMemberRepository port using database storage
 */

import type { ICrewMemberRepository } from "../domain/ports.js";
import type { SelectCrew, InsertCrew } from "@shared/schema";
import { dbCrewStorage } from "../../../db/crew/index.js";

export const crewMemberRepository: ICrewMemberRepository = {
  findAllCrew: async (orgId?: string, vesselId?: string): Promise<SelectCrew[]> => {
    return dbCrewStorage.getCrewMembers(orgId, vesselId ? { vesselId } : undefined);
  },
  findCrewById: async (id: string, orgId?: string): Promise<SelectCrew | undefined> => {
    return dbCrewStorage.getCrewMember(id, orgId);
  },
  createCrew: async (data: InsertCrew): Promise<SelectCrew> => {
    return dbCrewStorage.createCrewMember(data);
  },
  updateCrew: async (
    id: string,
    data: Partial<InsertCrew>,
    orgId?: string
  ): Promise<SelectCrew> => {
    return dbCrewStorage.updateCrewMember(id, data, orgId);
  },
  deleteCrew: async (id: string, orgId?: string): Promise<void> => {
    return dbCrewStorage.deleteCrewMember(id, orgId);
  },
};
