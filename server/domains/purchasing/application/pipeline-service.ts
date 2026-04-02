import type { IPurchaseEventRepository } from "../domain/ports";
import type {
  PurchasePipeline,
  PipelineStage,
  PipelineStageKey,
  PipelineDataSources,
  RawEvent,
} from "../domain/types";
import { PIPELINE_STAGE_KEYS } from "../domain/types";

const STAGE_META: Record<PipelineStageKey, { label: string; description: string }> = {
  request_created: { label: "Request Created", description: "Purchase request was created" },
  sent_to_supplier: { label: "Sent to Supplier", description: "Request sent to supplier(s)" },
  quote_received: { label: "Quote Received", description: "Supplier quotation received" },
  po_issued: { label: "PO Issued", description: "Purchase order issued" },
  shipped: { label: "Shipped", description: "Items shipped by supplier" },
  received: { label: "Received", description: "Items received at destination" },
  fulfilled: { label: "Fulfilled", description: "Items fulfilled to requester" },
};

const PR_EVENT_MAP: Record<string, PipelineStageKey> = {
  created: "request_created",
  draft_created: "request_created",
  draft_saved: "request_created",
  auto_saved: "request_created",
  item_added: "request_created",
  item_removed: "request_created",
  sent: "sent_to_supplier",
  submitted: "sent_to_supplier",
  approved: "quote_received",
  quote_received: "quote_received",
  quotation_received: "quote_received",
  ordered: "po_issued",
  po_created: "po_issued",
  po_linked: "po_issued",
  items_received: "received",
  received: "received",
  item_fulfilled: "fulfilled",
  fulfilled: "fulfilled",
  items_fulfilled: "fulfilled",
  closed: "fulfilled",
  completed: "fulfilled",
};

const PO_EVENT_MAP: Record<string, PipelineStageKey> = {
  created: "po_issued",
  sent: "sent_to_supplier",
  acknowledged: "quote_received",
  price_updated: "quote_received",
  shipped: "shipped",
  qty_updated: "received",
  received: "received",
  items_rejected: "received",
  fulfilled: "fulfilled",
};

function findEvent(
  events: RawEvent[],
  stageKey: PipelineStageKey,
  eventMap: Record<string, PipelineStageKey>
): RawEvent | null {
  const matchingTypes = Object.entries(eventMap)
    .filter(([, stage]) => stage === stageKey)
    .map(([type]) => type);

  for (const evt of events) {
    if (matchingTypes.includes(evt.eventType)) return evt;
  }
  return null;
}

function resolveStageFromStatus(prStatus: string): PipelineStageKey {
  const statusMap: Record<string, PipelineStageKey> = {
    draft: "request_created",
    submitted: "sent_to_supplier",
    sent: "sent_to_supplier",
    approved: "quote_received",
    acknowledged: "quote_received",
    ordered: "po_issued",
    po_issued: "po_issued",
    shipped: "shipped",
    received: "received",
    fulfilled: "fulfilled",
    closed: "fulfilled",
    cancelled: "request_created",
  };
  return statusMap[prStatus] ?? "request_created";
}

function stageIndex(key: PipelineStageKey): number {
  return PIPELINE_STAGE_KEYS.indexOf(key);
}

export class PurchasePipelineService {
  constructor(private readonly repo: IPurchaseEventRepository) {}

  async getPipeline(prId: string, orgId: string): Promise<PurchasePipeline | null> {
    const data = await this.repo.getPipelineData(prId, orgId);
    if (!data) return null;
    return this.assemblePipeline(prId, data);
  }

  async assemblePipeline(prId: string, data: PipelineDataSources): Promise<PurchasePipeline> {
    const currentStage = this.resolveCurrentStage(data);
    const currentIdx = stageIndex(currentStage);

    const userIds = new Set<string>();
    for (const evt of [...data.prEvents, ...data.poEvents]) {
      if (evt.userId) userIds.add(evt.userId);
    }
    const nameMap = await this.repo.resolveUserNames([...userIds]);

    const stages: PipelineStage[] = PIPELINE_STAGE_KEYS.map((key) => {
      const idx = stageIndex(key);
      const meta = STAGE_META[key];
      let status: PipelineStage["status"] = "upcoming";
      if (idx < currentIdx) status = "completed";
      else if (idx === currentIdx) status = "current";

      const { timestamp, actor, details } = this.resolveStageData(key, data);
      const actorName = actor ? (nameMap.get(actor) ?? actor) : null;

      return {
        key,
        label: meta.label,
        description: meta.description,
        status,
        timestamp,
        actor,
        actorName,
        details,
      };
    });

    return { prId, currentStage, stages };
  }

  private resolveCurrentStage(data: PipelineDataSources): PipelineStageKey {
    let highest = resolveStageFromStatus(data.prStatus);

    for (const evt of data.prEvents) {
      const mapped = PR_EVENT_MAP[evt.eventType];
      if (mapped && stageIndex(mapped) > stageIndex(highest)) {
        highest = mapped;
      }
    }

    for (const evt of data.poEvents) {
      const mapped = PO_EVENT_MAP[evt.eventType];
      if (mapped && stageIndex(mapped) > stageIndex(highest)) {
        highest = mapped;
      }
    }

    return highest;
  }

  private resolveStageData(
    key: PipelineStageKey,
    data: PipelineDataSources
  ): { timestamp: string | null; actor: string | null; details: Record<string, unknown> | null } {
    const prEvt = findEvent(data.prEvents, key, PR_EVENT_MAP);
    const poEvt = findEvent(data.poEvents, key, PO_EVENT_MAP);

    const evt = prEvt || poEvt;

    if (key === "request_created" && !evt && data.prCreatedAt) {
      return { timestamp: data.prCreatedAt.toISOString(), actor: null, details: null };
    }
    if (key === "sent_to_supplier" && !evt && data.prSentAt) {
      return { timestamp: data.prSentAt.toISOString(), actor: null, details: null };
    }

    if (!evt) return { timestamp: null, actor: null, details: null };

    return {
      timestamp: evt.createdAt?.toISOString() ?? null,
      actor: evt.userId,
      details: evt.details,
    };
  }
}
