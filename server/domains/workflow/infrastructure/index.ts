/**
 * Workflow — Infrastructure Layer (aggregated)
 *
 * workflow is a meta-domain. Its top-level Attention Inbox keeps its real source
 * adapters in `server/composition/workflow-attention-sources.ts` (outside the
 * domain) to avoid cross-domain storage leaks, so the only infrastructure
 * adapters that live *under* workflow/ belong to the operator-experience
 * sub-context. This barrel aggregates those adapters into a single
 * infrastructure surface at the domain root.
 */

export { AttentionWorkflowSignalsAdapter } from "../operator-experience/infrastructure/attention-signals.adapter.js";
export { FileOperatorExperienceEventStore } from "../operator-experience/infrastructure/file-event-store.adapter.js";
export { StaticOperatorRoleProfileAdapter } from "../operator-experience/infrastructure/static-role-profile.adapter.js";
export { StaticRoleInformationCatalogAdapter } from "../operator-experience/information-needs/infrastructure/static-role-information-catalog.adapter.js";
