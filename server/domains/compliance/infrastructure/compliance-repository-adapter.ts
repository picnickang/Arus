/**
 * Compliance Infrastructure - Repository Adapter
 *
 * Binds IComplianceRepository to dbComplianceStorage. This is the only
 * compliance layer that imports the storage subpackage; the wider storage
 * object satisfies the narrower port via structural typing.
 */

import type { IComplianceRepository } from "../domain/ports";
import { dbComplianceStorage } from "../../../db/compliance/db-compliance.js";

export const complianceRepository: IComplianceRepository = dbComplianceStorage;
