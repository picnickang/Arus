/**
 * Repository access for the checklist routes, held in infrastructure/ per
 * the domain-repositories-imports boundary: interfaces/ declares the HTTP
 * surface, infrastructure/ owns storage access. The underlying storages are
 * owned by the work-orders domain, so the raw storage symbols live in the
 * composition seam (the domain-leak guard counts storage tokens inside
 * domains/); this module exposes them to the routes as ports.
 */

export {
  checklistsPort,
  checklistWorkOrdersPort,
} from "../../../composition/maintenance-checklists.js";
