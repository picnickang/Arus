import { z } from "zod";
import { db } from "../../../db";
import { sql } from "drizzle-orm";
import { registerTool } from "./registry";
import { fetchWithCacheFallback } from "../infrastructure/external-data-cache";

// ---------------------------------------------------------------------------
// Config — adapt to your procurement / parts supplier API
// (ShipServ, MarineTraffic Parts, OEM direct APIs, internal ERP, etc.)
// ---------------------------------------------------------------------------

const PARTS_API_BASE = process.env.PARTS_SUPPLIER_API_URL || "";
const PARTS_API_KEY = process.env.PARTS_SUPPLIER_API_KEY || "";
const PARTS_CACHE_TTL_SEC = 43200; // 12 hours

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SupplierQuote {
  supplierName: string;
  supplierLocation: string;
  unitPrice: number;
  currency: string;
  moq: number;
  leadTimeDays: number;
  inStock: boolean;
  lastUpdated: string;
}

interface PartAvailability {
  partNumber: string;
  partName: string;
  manufacturer: string | null;
  category: string | null;
  quotes: SupplierQuote[];
  bestPrice: SupplierQuote | null;
  fastestDelivery: SupplierQuote | null;
  averageLeadTimeDays: number | null;
  inStockCount: number;
}

// ---------------------------------------------------------------------------
// Fetch function — adapt to your supplier API
// ---------------------------------------------------------------------------

async function fetchPartAvailability(
  partNumber: string,
  manufacturer?: string,
): Promise<PartAvailability> {
  if (!PARTS_API_BASE || !PARTS_API_KEY) {
    throw new Error("PARTS_SUPPLIER_API_URL/KEY not configured");
  }

  const params = new URLSearchParams({ partNumber });
  if (manufacturer) {params.set("manufacturer", manufacturer);}

  const response = await fetch(`${PARTS_API_BASE}/parts/availability?${params}`, {
    headers: { Authorization: `Bearer ${PARTS_API_KEY}` },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Parts API returned ${response.status}`);
  }

  const body = await response.json();

  const quotes = (body.quotes || []) as SupplierQuote[];
  const inStockQuotes = quotes.filter(q => q.inStock);
  const sortedByPrice = [...quotes].sort((a, b) => a.unitPrice - b.unitPrice);
  const sortedByLead = [...quotes].sort((a, b) => a.leadTimeDays - b.leadTimeDays);

  return {
    partNumber,
    partName: body.partName || partNumber,
    manufacturer: body.manufacturer || manufacturer || null,
    category: body.category || null,
    quotes,
    bestPrice: sortedByPrice[0] || null,
    fastestDelivery: sortedByLead[0] || null,
    averageLeadTimeDays: quotes.length > 0
      ? Math.round(quotes.reduce((s, q) => s + q.leadTimeDays, 0) / quotes.length)
      : null,
    inStockCount: inStockQuotes.length,
  };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

registerTool({
  name: "getPartAvailability",
  category: "inventory",
  riskLevel: "read",
  description:
    "Check external supplier availability, pricing, and lead times for a spare part. " +
    "Returns quotes from multiple suppliers with best-price and fastest-delivery picks. " +
    "Useful when the inventory shows low stock and a purchase decision is needed. " +
    "Data is cached for 12 hours and available offline.",
  parameters: {
    type: "object",
    properties: {
      partNumber: {
        type: "string",
        description: "Part number or catalog reference to search for",
      },
      partName: {
        type: "string",
        description: "Human-readable part name (used as fallback search if partNumber not found)",
      },
      manufacturer: {
        type: "string",
        description: "Optional manufacturer name to narrow results",
      },
    },
    required: ["partNumber"],
  },
  inputSchema: z.object({
    partNumber: z.string().min(1),
    partName: z.string().optional(),
    manufacturer: z.string().optional(),
  }),
  requiresApproval: false,
  async execute(input, ctx) {
    const partNumber = input.partNumber as string;
    const manufacturer = input.manufacturer as string | undefined;

    const cacheKey = `part_${partNumber}${manufacturer ? `_${manufacturer}` : ""}`;

    const result = await fetchWithCacheFallback<PartAvailability>(
      ctx.orgId,
      "parts",
      cacheKey,
      () => fetchPartAvailability(partNumber, manufacturer),
      PARTS_CACHE_TTL_SEC,
    );

    const data = result.data;
    if (!data || (data as Record<string, unknown>).error) {
      return {
        partNumber,
        error: (data as Record<string, unknown>)?.error || "Part availability data unavailable",
        _meta: {
          fromCache: result.fromCache,
          stale: result.stale,
          dataAge: result.ageLabel,
          fetchError: result.fetchError,
        },
      };
    }

    return {
      ...data,
      _meta: {
        fromCache: result.fromCache,
        stale: result.stale,
        dataAge: result.ageLabel,
        fetchError: result.fetchError,
      },
    };
  },
});

registerTool({
  name: "getLowStockWithSupplierInfo",
  category: "inventory",
  riskLevel: "read",
  description:
    "Get parts that are at or below minimum stock level, enriched with external supplier " +
    "pricing and lead time data. Combines local inventory status with external market data " +
    "to help prioritize reordering decisions. Returns the local inventory data even if " +
    "external supplier lookups fail.",
  parameters: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Maximum number of low-stock items to return (default 10)",
      },
      includeSupplierData: {
        type: "boolean",
        description: "Whether to fetch external supplier quotes (default true). Set false for faster offline-only results.",
      },
    },
    required: [],
  },
  inputSchema: z.object({
    limit: z.number().int().min(1).max(50).optional(),
    includeSupplierData: z.boolean().optional(),
  }),
  requiresApproval: false,
  async execute(input, ctx) {
    const limit = (input.limit as number) || 10;
    const includeSupplier = (input.includeSupplierData as boolean) !== false;

    // Fetch low-stock items from local inventory
    let lowStockParts: Array<Record<string, unknown>> = [];
    try {
      const result = await db.execute(sql`
        SELECT id, part_number, part_name, manufacturer, quantity_on_hand,
               min_stock_level, unit_cost, last_ordered_date, category
        FROM parts_inventory
        WHERE org_id = ${ctx.orgId}
          AND quantity_on_hand <= min_stock_level
        ORDER BY (min_stock_level - quantity_on_hand) DESC
        LIMIT ${limit}
      `);
      lowStockParts = ((result as { rows?: Array<Record<string, unknown>> }).rows || []);
    } catch (err) {
      return {
        error: "Could not query inventory — parts_inventory table may not exist yet",
        details: err instanceof Error ? err.message : "unknown",
      };
    }

    if (lowStockParts.length === 0) {
      return {
        items: [],
        totalLowStock: 0,
        message: "No parts are currently at or below minimum stock levels.",
      };
    }

    // Enrich with external supplier data
    const enriched = await Promise.all(
      lowStockParts.map(async (part) => {
        const partNumber = part.part_number as string;
        const base = {
          id: part.id,
          partNumber,
          partName: part.part_name,
          manufacturer: part.manufacturer,
          category: part.category,
          quantityOnHand: Number(part.quantity_on_hand),
          minStockLevel: Number(part.min_stock_level),
          deficit: Number(part.min_stock_level) - Number(part.quantity_on_hand),
          lastUnitCost: part.unit_cost ? Number(part.unit_cost) : null,
          lastOrderedDate: part.last_ordered_date,
        };

        if (!includeSupplier || !partNumber) {
          return { ...base, supplierData: null };
        }

        // Try cache first for speed, fall back to live fetch
        const cacheKey = `part_${partNumber}${part.manufacturer ? `_${part.manufacturer}` : ""}`;
        const cached = await fetchWithCacheFallback<PartAvailability>(
          ctx.orgId,
          "parts",
          cacheKey,
          () => fetchPartAvailability(partNumber, part.manufacturer as string | undefined),
          PARTS_CACHE_TTL_SEC,
        ).catch(() => null);

        if (!cached || (cached.data as Record<string, unknown>)?.error) {
          return { ...base, supplierData: null, supplierError: "External data unavailable" };
        }

        return {
          ...base,
          supplierData: {
            quoteCount: cached.data.quotes?.length ?? 0,
            bestPrice: cached.data.bestPrice,
            fastestDelivery: cached.data.fastestDelivery,
            averageLeadTimeDays: cached.data.averageLeadTimeDays,
            inStockSuppliers: cached.data.inStockCount,
            dataAge: cached.ageLabel,
            stale: cached.stale,
          },
        };
      }),
    );

    // Prioritise: critical items with long lead times first
    enriched.sort((a, b) => {
      // Items with no supplier data sort last
      const aLead = a.supplierData?.averageLeadTimeDays ?? 0;
      const bLead = b.supplierData?.averageLeadTimeDays ?? 0;
      // Higher deficit * longer lead time = higher priority
      const aPriority = a.deficit * (1 + aLead / 30);
      const bPriority = b.deficit * (1 + bLead / 30);
      return bPriority - aPriority;
    });

    return {
      items: enriched,
      totalLowStock: enriched.length,
      supplierDataIncluded: includeSupplier,
      summary: {
        criticalItems: enriched.filter(e => e.quantityOnHand === 0).length,
        withSupplierQuotes: enriched.filter(e => e.supplierData && e.supplierData.quoteCount > 0).length,
        averageLeadDays: (() => {
          const leads = enriched
            .map(e => e.supplierData?.averageLeadTimeDays)
            .filter((v): v is number => v != null);
          return leads.length > 0 ? Math.round(leads.reduce((a, b) => a + b, 0) / leads.length) : null;
        })(),
      },
    };
  },
});
