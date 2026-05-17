/**
 * Crew Routes - Skills
 * Skill management and crew-skill assignments
 */

import { insertSkillSchema } from "@shared/schema-runtime";
import { crewAppService as crewService } from "../application/index.js";
import {
  requireOrgId,
  requireOrgIdAndValidateBody,
  AuthenticatedRequest,
} from "../../../middleware/auth";
import { withErrorHandling, sendCreated, sendDeleted } from "../../../lib/route-utils.js";
import type { CrewRouteDeps } from "./types.js";

export function registerSkillsRoutes({ app, rateLimit }: CrewRouteDeps): void {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  app.get(
    "/api/skills",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch skills", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const skills = await crewService.listSkills(orgId);
      res.json(skills);
    })
  );

  app.post(
    "/api/skills",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create skill", async (req, res) => {
      const skillData = insertSkillSchema.parse(req.body);
      const skill = await crewService.createSkill(skillData, req.user?.id);
      sendCreated(res, skill);
    })
  );

  app.delete(
    "/api/skills/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete skill", async (req: any, res) => {
      await crewService.deleteSkill(req.params.id, req.orgId);
      sendDeleted(res);
    })
  );

  app.post(
    "/api/crew/:crewId/skills/:skillId",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("assign skill to crew member", async (req, res) => {
      const { crewId, skillId } = req.params;
      const { level } = req.body;

      if (typeof level !== "number" || level < 1 || level > 5) {
        res.status(400).json({
          message: "Level must be a number between 1 and 5",
        });
        return;
      }

      const crewSkill = await crewService.assignSkillToCrew(crewId, skillId, level, req.user?.id);
      sendCreated(res, crewSkill);
    })
  );

  app.delete(
    "/api/crew/:crewId/skills/:skillId",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("remove skill from crew member", async (req, res) => {
      const { crewId, skillId } = req.params;
      await crewService.removeSkillFromCrew(crewId, skillId, req.user?.id);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/crew/:id/skills",
    generalApiRateLimit,
    withErrorHandling("fetch crew skills", async (req, res) => {
      const skills = await crewService.getCrewSkills(req.params.id);
      res.json(skills);
    })
  );
}
