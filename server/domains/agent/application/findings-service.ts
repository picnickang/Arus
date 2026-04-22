import type {
  FindingsAggregatorPort,
  FindingsFilter,
  FindingsPagination,
  FindingsSummary,
  UnifiedFindingItem,
} from "../domain/findings-types";

export class FindingsAggregatorService {
  constructor(private readonly adapter: FindingsAggregatorPort) {}

  async getFindings(
    orgId: string,
    filter?: FindingsFilter,
    pagination?: FindingsPagination
  ): Promise<{ items: UnifiedFindingItem[]; total: number }> {
    return this.adapter.getFindings(orgId, filter, pagination);
  }

  async getSummary(orgId: string): Promise<FindingsSummary> {
    return this.adapter.getSummary(orgId);
  }
}
