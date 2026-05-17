/**
 * Legacy supplier analytics shim.
 */

export interface SupplierPerformance {
  supplierId: string;
  onTimeDeliveryRate: number;
  qualityScore: number;
  totalOrders: number;
  totalSpend: number;
}

export async function analyzeSupplierPerformance(
  _orgId: string,
  supplierIds: string[],
  _dateRange: { from: Date; to: Date } | undefined,
  _storage: unknown
): Promise<SupplierPerformance[]> {
  return supplierIds.map((id) => ({
    supplierId: id,
    onTimeDeliveryRate: 0,
    qualityScore: 0,
    totalOrders: 0,
    totalSpend: 0,
  }));
}
