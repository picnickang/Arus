import { z } from "zod";
import { registerTool } from "./registry";
import { enhancedLLM } from "../../../enhanced-llm/enhanced-llm";
import type { Audience } from "../../../enhanced-llm/types";

const AUDIENCE_MAP: Record<string, Audience> = {
  admin: "executive",
  captain: "executive",
  chief_officer: "executive",
  chief_engineer: "technical",
  second_engineer: "technical",
  engineer: "technical",
  technician: "maintenance",
  maintenance: "maintenance",
  compliance_officer: "compliance",
  system: "technical",
};

function resolveAudience(userRole?: string, requestedAudience?: string): Audience {
  if (requestedAudience && ["executive", "technical", "maintenance", "compliance"].includes(requestedAudience)) {
    return requestedAudience as Audience;
  }
  if (userRole) {
    return AUDIENCE_MAP[userRole.toLowerCase()] || "technical";
  }
  return "technical";
}

registerTool({
  name: "generateEnhancedReport",
  description: "Generate a comprehensive AI-powered report using the Enhanced LLM service. Supports report types: health (vessel health), fleet_summary (fleet-wide overview), maintenance (maintenance analysis), compliance (regulatory compliance). Reports are audience-aware (executive, technical, maintenance, compliance) and can include scenario analysis and ROI calculations.",
  parameters: {
    type: "object",
    properties: {
      reportType: {
        type: "string",
        enum: ["health", "fleet_summary", "maintenance", "compliance"],
        description: "Type of report to generate",
      },
      vesselId: {
        type: "string",
        description: "Vessel ID to scope the report. Required for 'health' reports, optional for 'maintenance' and 'compliance', not used for 'fleet_summary'.",
      },
      audience: {
        type: "string",
        enum: ["executive", "technical", "maintenance", "compliance"],
        description: "Target audience for the report. If not specified, automatically determined from user role.",
      },
      includeScenarios: {
        type: "boolean",
        description: "Include what-if scenario analysis (default false)",
      },
      includeROI: {
        type: "boolean",
        description: "Include ROI/cost-benefit analysis (default false). Only applies to health and fleet_summary reports.",
      },
    },
    required: ["reportType"],
  },
  inputSchema: z.object({
    reportType: z.enum(["health", "fleet_summary", "maintenance", "compliance"]),
    vesselId: z.string().optional(),
    audience: z.enum(["executive", "technical", "maintenance", "compliance"]).optional(),
    includeScenarios: z.boolean().optional(),
    includeROI: z.boolean().optional(),
  }),
  requiresApproval: false,
  async execute(input, ctx) {
    const {
      reportType,
      vesselId,
      audience: requestedAudience,
      includeScenarios,
      includeROI,
    } = input as {
      reportType: "health" | "fleet_summary" | "maintenance" | "compliance";
      vesselId?: string;
      audience?: string;
      includeScenarios?: boolean;
      includeROI?: boolean;
    };

    const audience = resolveAudience(ctx.userRole, requestedAudience);
    const options = {
      includeScenarios: includeScenarios || false,
      includeROI: includeROI || false,
    };

    try {
      let result;

      switch (reportType) {
        case "health": {
          if (!vesselId) {
            return { error: "vesselId is required for health reports. Please specify which vessel to generate the report for." };
          }
          result = await enhancedLLM.generateVesselHealthReport(vesselId, audience, options);
          break;
        }
        case "fleet_summary": {
          result = await enhancedLLM.generateFleetSummaryReport(audience, options);
          break;
        }
        case "maintenance": {
          result = await enhancedLLM.generateMaintenanceReport(vesselId, audience, options);
          break;
        }
        case "compliance": {
          result = await enhancedLLM.generateComplianceReport(vesselId, audience, options);
          break;
        }
        default:
          return { error: `Unknown report type: ${reportType}` };
      }

      const response: Record<string, unknown> = {
        reportType,
        audience,
        generatedAt: new Date().toISOString(),
        analysis: result.analysis,
        confidence: result.confidence,
        metadata: result.metadata,
      };

      if (result.scenarios && result.scenarios.length > 0) {
        response.scenarios = result.scenarios;
      }
      if (result.roi) {
        response.roi = result.roi;
      }
      if (result.citations && result.citations.length > 0) {
        response.citations = result.citations.slice(0, 5);
      }
      if (vesselId) {
        response.vesselId = vesselId;
      }

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("not initialized") || message.includes("API key")) {
        return {
          error: "AI report generation is not available. The OpenAI API key may not be configured.",
          suggestion: "Please ensure the OpenAI API key is set in system settings.",
        };
      }
      if (message.includes("not found") || message.includes("No vessel")) {
        return {
          error: `Vessel not found: ${vesselId || "unknown"}. Please verify the vessel ID and try again.`,
          suggestion: "Use the getVesselOverview tool to look up valid vessel IDs first.",
        };
      }
      if (message.includes("No data") || message.includes("no telemetry")) {
        return {
          error: `Insufficient data to generate ${reportType} report${vesselId ? ` for vessel ${vesselId}` : ""}.`,
          suggestion: "Ensure the vessel has recent telemetry or maintenance data before requesting a report.",
        };
      }
      return { error: `Report generation failed: ${message}` };
    }
  },
});
