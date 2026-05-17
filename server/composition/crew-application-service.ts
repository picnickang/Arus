/**
 * Composition root for the Crew Application Service.
 *
 * Lives outside `server/domains/` on purpose: the crew domain expresses
 * its dependencies as ports (see
 * `server/domains/crew/application/crew-service.ts`), and this file is
 * the only place that wires those ports to the concrete `dbCrewStorage`
 * and `dbCrewExtensionsStorage` adapters from the repositories barrel.
 *
 * Infrastructure adapters internal to the crew domain
 * (`crewMemberRepository`, `crewEventPublisher`) remain wired here so the
 * full dependency set is visible in one place.
 */

import { dbCrewStorage, dbCrewExtensionsStorage } from "../repositories.js";
import {
  CrewApplicationService,
  type CrewStoragePort,
} from "../domains/crew/application/crew-service.js";
import { crewMemberRepository } from "../domains/crew/infrastructure/crew-repository-adapter.js";
import { crewEventPublisher } from "../domains/crew/infrastructure/event-publisher-adapter.js";
import { db } from "../db-config.js";
import { crew, crewSkill } from "@shared/schema-runtime";
import { and, eq } from "drizzle-orm";

async function getCrewOrgId(crewId: string): Promise<string> {
  const [row] = await db
    .select({ orgId: crew.orgId })
    .from(crew)
    .where(eq(crew.id, crewId))
    .limit(1);
  if (!row?.orgId) {
    throw new Error(`Crew member ${crewId} not found or has no orgId`);
  }
  return row.orgId;
}

const crewStoragePort: CrewStoragePort = {
  ...dbCrewStorage,
  getCrewSkills: (crewId: string) => dbCrewStorage.getCrewSkills(crewId),
  assignSkillToCrew: async (crewId: string, skillId: string, level: string) => {
    const orgId = await getCrewOrgId(crewId);
    const lvl = Number.parseInt(level, 10);
    const [row] = await db
      .insert(crewSkill)
      .values({
        orgId,
        crewId,
        skill: skillId,
        level: Number.isFinite(lvl) ? lvl : 1,
      })
      .returning();
    return row;
  },
  removeSkillFromCrew: async (crewId: string, skillId: string) => {
    const orgId = await getCrewOrgId(crewId);
    await db
      .delete(crewSkill)
      .where(
        and(
          eq(crewSkill.orgId, orgId),
          eq(crewSkill.crewId, crewId),
          eq(crewSkill.skill, skillId)
        )
      );
    return { success: true };
  },
} as unknown as CrewStoragePort;

export const crewAppService = new CrewApplicationService({
  crewMemberRepository,
  eventPublisher: crewEventPublisher,
  crewStorage: crewStoragePort,
  crewExtensionsStorage: dbCrewExtensionsStorage,
});
