/**
 * Composition - Alert Crew Data Provider
 *
 * Wires the alerts domain's `ICrewAlertDataPort` to the crew storage layer.
 * This adapter lives in the composition layer (outside `server/domains/`) on
 * purpose: it is the cross-domain seam between alerts and crew, so the alerts
 * domain itself stays free of `dbCrewStorage` coupling (see
 * server/domains/alerts/evaluators/types.ts).
 */

import type { Crew, CrewCertification, CrewAssignment } from "@shared/schema";
import type { ICrewAlertDataPort } from "../domains/alerts/evaluators/types";
import { dbCrewStorage } from "../repositories";

class AlertCrewDataAdapter implements ICrewAlertDataPort {
  getCrew(orgId: string, vesselId?: string): Promise<Crew[]> {
    return dbCrewStorage.getCrew(orgId, vesselId);
  }

  getCrewCertifications(crewId: string, orgId: string): Promise<CrewCertification[]> {
    return dbCrewStorage.getCrewCertifications(crewId, orgId);
  }

  getCrewAssignments(orgId: string, filters: { vesselId?: string }): Promise<CrewAssignment[]> {
    return dbCrewStorage.getCrewAssignments(orgId, filters);
  }
}

export const alertCrewDataProvider: ICrewAlertDataPort = new AlertCrewDataAdapter();
