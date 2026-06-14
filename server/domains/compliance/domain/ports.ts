/**
 * Compliance Domain - Ports
 *
 * The compliance storage (dbComplianceStorage) returns raw query rows and uses
 * unexported db-local param types, so the repository port is derived structurally
 * from the storage shape via `Pick` rather than hand-transcribed. The concrete
 * binding lives in infrastructure/, keeping the storage import out of the
 * application and interface layers. (`import type` from a `db/<area>/`
 * subpackage is permitted by the storage-boundary guards.)
 */

import type { dbComplianceStorage } from "../../../db/compliance/db-compliance.js";

export type IComplianceRepository = Pick<
  typeof dbComplianceStorage,
  | "getComplianceFindings"
  | "getComplianceFindingById"
  | "createComplianceFinding"
  | "acknowledgeComplianceFinding"
  | "resolveComplianceFinding"
  | "suppressComplianceFinding"
  | "deleteComplianceFinding"
  | "getComplianceRules"
  | "getComplianceRuleById"
  | "createComplianceRule"
  | "updateComplianceRule"
  | "deleteComplianceRule"
>;
