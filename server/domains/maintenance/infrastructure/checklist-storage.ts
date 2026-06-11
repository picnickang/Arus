/**
 * Repository access for the checklist routes, held in infrastructure/ per
 * the domain-repositories-imports boundary: interfaces/ declares the HTTP
 * surface, infrastructure/ owns storage access. The checklist routes are a
 * thin CRUD layer over these two storages (no domain service between them
 * yet); when one grows, inject these through a port in domain/ports
 * instead of widening this re-export.
 */

export { dbChecklistsStorage, dbWorkOrderStorage } from "../../../repositories";
