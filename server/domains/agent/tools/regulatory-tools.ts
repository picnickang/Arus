import { z } from "zod";
import { registerTool } from "./registry";
import { fetchWithCacheFallback } from "../infrastructure/external-data-cache";

// ---------------------------------------------------------------------------
// Config — adapt to your regulatory data provider
// Paris MoU, Tokyo MoU, USCG PSC, Equasis, ClassNK, etc.
// ---------------------------------------------------------------------------

const REGULATORY_API_BASE = process.env.MARITIME_REGULATORY_API_URL || "";
const REGULATORY_API_KEY = process.env.MARITIME_REGULATORY_API_KEY || "";
const REGULATORY_CACHE_TTL_SEC = 86400; // 24 hours — regulatory data changes slowly

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PSCDeficiency {
  code: string;
  description: string;
  category: string;
  actionRequired: string;
  isDetainable: boolean;
}

interface PSCRecord {
  inspectionDate: string;
  port: string;
  authority: string;
  result: "no_deficiency" | "deficiency" | "detention";
  deficiencyCount: number;
  deficiencies: PSCDeficiency[];
  detentionDays: number | null;
}

interface RegulatoryNotice {
  id: string;
  title: string;
  authority: string;
  datePublished: string;
  effectiveDate: string | null;
  category: string;
  summary: string;
  url: string | null;
  affectsVesselTypes: string[];
}

interface ComplianceStatus {
  imoNumber: string;
  vesselName: string;
  flagState: string;
  classificationSociety: string | null;
  certificates: Array<{
    name: string;
    issueDate: string;
    expiryDate: string;
    status: "valid" | "expiring_soon" | "expired";
    daysUntilExpiry: number;
  }>;
  recentPSC: PSCRecord[];
  riskProfile: "standard" | "elevated" | "high";
  upcomingRequirements: string[];
}

// ---------------------------------------------------------------------------
// Fetch functions — adapt these to your actual API
// ---------------------------------------------------------------------------

async function fetchPSCHistory(imoNumber: string): Promise<PSCRecord[]> {
  if (!REGULATORY_API_BASE || !REGULATORY_API_KEY) {
    throw new Error("MARITIME_REGULATORY_API_URL/KEY not configured");
  }

  const response = await fetch(`${REGULATORY_API_BASE}/psc/history?imo=${imoNumber}`, {
    headers: { Authorization: `Bearer ${REGULATORY_API_KEY}` },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Regulatory API returned ${response.status}`);
  }

  const body = await response.json();
  return (body.inspections || []) as PSCRecord[];
}

async function fetchRegulatoryNotices(
  flagState?: string,
  vesselType?: string
): Promise<RegulatoryNotice[]> {
  if (!REGULATORY_API_BASE || !REGULATORY_API_KEY) {
    throw new Error("MARITIME_REGULATORY_API_URL/KEY not configured");
  }

  const params = new URLSearchParams();
  if (flagState) {
    params.set("flag", flagState);
  }
  if (vesselType) {
    params.set("vesselType", vesselType);
  }
  params.set("limit", "20");
  params.set("recent", "true");

  const response = await fetch(`${REGULATORY_API_BASE}/notices?${params}`, {
    headers: { Authorization: `Bearer ${REGULATORY_API_KEY}` },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Regulatory API returned ${response.status}`);
  }

  const body = await response.json();
  return (body.notices || []) as RegulatoryNotice[];
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

registerTool({
  name: "getPortStateControlHistory",
  category: "compliance",
  riskLevel: "read",
  description:
    "Retrieve Port State Control (PSC) inspection history for a vessel by IMO number. " +
    "Shows recent inspections, deficiencies found, detentions, and deficiency categories. " +
    "Useful for compliance reviews and pre-arrival risk assessment. " +
    "Data is cached for 24 hours and available offline with a staleness indicator.",
  parameters: {
    type: "object",
    properties: {
      imoNumber: {
        type: "string",
        description: "IMO number of the vessel (7 digits)",
      },
      vesselId: {
        type: "string",
        description: "Optional ARUS vessel ID — will look up the IMO number from the vessel record",
      },
    },
    required: [],
  },
  inputSchema: z
    .object({
      imoNumber: z
        .string()
        .regex(/^\d{7}$/)
        .optional(),
      vesselId: z.string().optional(),
    })
    .refine((data) => data.imoNumber || data.vesselId, {
      message: "Either imoNumber or vesselId is required",
    }),
  requiresApproval: false,
  async execute(input, ctx) {
    let imoNumber = input.imoNumber as string | undefined;
    let vesselName: string | undefined;

    // Resolve IMO from vessel record
    if (!imoNumber && input.vesselId) {
      const { vessels } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const { db } = await import("../../../db");

      const [vessel] = await db
        .select()
        .from(vessels)
        .where(and(eq(vessels.id, input.vesselId as string), eq(vessels.orgId, ctx.orgId)));

      if (!vessel) {
        return { error: `Vessel ${input.vesselId} not found` };
      }
      if (!vessel.imo) {
        return { error: `No IMO number recorded for vessel ${vessel.name}` };
      }

      imoNumber = vessel.imo;
      vesselName = vessel.name;
    }

    if (!imoNumber) {
      return { error: "Either imoNumber or vesselId is required" };
    }

    const result = await fetchWithCacheFallback<PSCRecord[]>(
      ctx.orgId,
      "psc",
      imoNumber,
      () => fetchPSCHistory(imoNumber!),
      REGULATORY_CACHE_TTL_SEC
    );

    const errOrOffline = result.data as { error?: unknown; offline?: unknown } | undefined;
    if (errOrOffline?.error || errOrOffline?.offline) {
      const isNotConfigured = result.fetchError?.includes("not configured");
      return {
        imoNumber,
        ...(vesselName ? { vesselName } : {}),
        error: isNotConfigured
          ? "PSC data unavailable — MARITIME_REGULATORY_API_URL/KEY not configured"
          : "PSC data unavailable — external API unreachable and no cached data exists",
        reason: isNotConfigured ? "not_configured" : "unreachable",
        _meta: {
          fromCache: result.fromCache,
          stale: result.stale,
          dataAge: result.ageLabel,
          fetchError: result.fetchError,
        },
      };
    }

    const inspections = Array.isArray(result.data) ? result.data : [];
    const totalDeficiencies = inspections.reduce((sum, r) => sum + r.deficiencyCount, 0);
    const detentions = inspections.filter((r) => r.result === "detention");

    // Common deficiency categories
    const categoryCounts: Record<string, number> = {};
    for (const insp of inspections) {
      for (const def of insp.deficiencies || []) {
        categoryCounts[def.category] = (categoryCounts[def.category] || 0) + 1;
      }
    }
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    return {
      imoNumber,
      ...(vesselName ? { vesselName } : {}),
      totalInspections: inspections.length,
      totalDeficiencies,
      detentionCount: detentions.length,
      topDeficiencyCategories: topCategories,
      recentInspections: inspections.slice(0, 10),
      riskIndicator:
        detentions.length > 0
          ? "high"
          : totalDeficiencies > inspections.length * 2
            ? "elevated"
            : "standard",
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
  name: "getRegulatoryNotices",
  category: "compliance",
  riskLevel: "read",
  description:
    "Get recent maritime regulatory notices, flag state advisories, and IMO circulars. " +
    "Can be filtered by flag state and vessel type. Useful for compliance planning and " +
    "staying current with regulatory changes. Cached for 24 hours.",
  parameters: {
    type: "object",
    properties: {
      flagState: {
        type: "string",
        description:
          "ISO country code of the flag state (e.g., 'PA' for Panama, 'LR' for Liberia, 'MH' for Marshall Islands)",
      },
      vesselType: {
        type: "string",
        description:
          "Vessel type filter (e.g., 'bulk_carrier', 'tanker', 'container', 'general_cargo')",
      },
      vesselId: {
        type: "string",
        description:
          "Optional ARUS vessel ID — will look up the flag state and type from the vessel record",
      },
    },
    required: [],
  },
  inputSchema: z.object({
    flagState: z.string().optional(),
    vesselType: z.string().optional(),
    vesselId: z.string().optional(),
  }),
  requiresApproval: false,
  async execute(input, ctx) {
    let flagState = input.flagState as string | undefined;
    let vesselType = input.vesselType as string | undefined;

    // Resolve from vessel record
    if (input.vesselId && (!flagState || !vesselType)) {
      const { vessels } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const { db } = await import("../../../db");

      const [vessel] = await db
        .select()
        .from(vessels)
        .where(and(eq(vessels.id, input.vesselId as string), eq(vessels.orgId, ctx.orgId)));

      if (vessel) {
        if (!flagState && vessel.flag) {
          flagState = vessel.flag;
        }
        if (!vesselType && vessel.vesselType) {
          vesselType = vessel.vesselType;
        }
      }
    }

    const cacheKey = `notices_${flagState || "all"}_${vesselType || "all"}`;

    const result = await fetchWithCacheFallback<RegulatoryNotice[]>(
      ctx.orgId,
      "regulatory_notices",
      cacheKey,
      () => fetchRegulatoryNotices(flagState, vesselType),
      REGULATORY_CACHE_TTL_SEC
    );

    const errOrOffline2 = result.data as { error?: unknown; offline?: unknown } | undefined;
    if (errOrOffline2?.error || errOrOffline2?.offline) {
      const isNotConfigured = result.fetchError?.includes("not configured");
      return {
        error: isNotConfigured
          ? "Regulatory notices unavailable — MARITIME_REGULATORY_API_URL/KEY not configured"
          : "Regulatory notices unavailable — external API unreachable and no cached data exists",
        reason: isNotConfigured ? "not_configured" : "unreachable",
        filters: { flagState: flagState || "all", vesselType: vesselType || "all" },
        _meta: {
          fromCache: result.fromCache,
          stale: result.stale,
          dataAge: result.ageLabel,
          fetchError: result.fetchError,
        },
      };
    }

    const notices = Array.isArray(result.data) ? result.data : [];

    // Group by category
    const byCategory: Record<string, RegulatoryNotice[]> = {};
    for (const notice of notices) {
      const cat = notice.category || "general";
      if (!byCategory[cat]) {
        byCategory[cat] = [];
      }
      byCategory[cat].push(notice);
    }

    return {
      totalNotices: notices.length,
      filters: { flagState: flagState || "all", vesselType: vesselType || "all" },
      notices: notices.slice(0, 15),
      byCategory: Object.entries(byCategory).map(([category, items]) => ({
        category,
        count: items.length,
      })),
      _meta: {
        fromCache: result.fromCache,
        stale: result.stale,
        dataAge: result.ageLabel,
        fetchError: result.fetchError,
      },
    };
  },
});
