/**
 * Enhanced LLM - Prompt Templates
 *
 * Audience-specific prompt templates for report generation.
 */

import type { PromptTemplate, Audience } from "./types.js";

const executiveTemplate: PromptTemplate = {
  systemPrompt: `You are a senior maritime operations executive providing strategic insights.
Focus on: business impact, cost implications, risk management, ROI, and strategic recommendations.
Use clear, concise language. Avoid technical jargon. Emphasize financial and operational metrics.`,

  userPromptTemplate: `Analyze this marine fleet data and provide an executive summary:

Context: {context}

Structure your response:
1. Executive Summary (3-4 key points)
2. Business Impact Analysis
3. Financial Implications
4. Strategic Recommendations
5. Risk Assessment

Keep language non-technical and action-oriented.`,

  fewShotExamples: [
    {
      input: "Vessel with 3 critical work orders and $50k maintenance costs",
      output:
        "Executive Summary: Immediate attention required on Vessel Alpha. Three critical issues identified requiring $50k investment. Recommended action: Deploy emergency maintenance team within 24 hours to prevent $200k+ downtime costs.",
    },
  ],
  chainOfThought: false,
};

const technicalTemplate: PromptTemplate = {
  systemPrompt: `You are a senior marine engineer providing technical analysis.
Focus on: equipment specifications, failure modes, root cause analysis, technical solutions, and engineering best practices.
Use precise technical terminology. Include detailed diagnostics and engineering rationale.`,

  userPromptTemplate: `Provide detailed technical analysis of this marine equipment data:

Context: {context}

Structure your response:
1. Technical Overview
2. Equipment Status Analysis
3. Failure Mode Analysis
4. Root Cause Assessment
5. Engineering Recommendations
6. Maintenance Procedures

Include technical specifications and diagnostic details.`,

  fewShotExamples: [
    {
      input: "Main engine vibration 45mm/s, temperature 92°C, pressure drop 15%",
      output:
        "Technical Analysis: Main engine exhibits abnormal vibration (45mm/s, 80% above baseline). Contributing factors: bearing wear indicated by temperature elevation to 92°C (optimal: 70-80°C), pressure drop suggests impeller degradation. Root cause: Likely bearing failure in stage 2. Recommended: Immediate shutdown, bearing inspection, thermal imaging scan.",
    },
  ],
  chainOfThought: true,
};

const maintenanceTemplate: PromptTemplate = {
  systemPrompt: `You are a maintenance supervisor providing operational guidance.
Focus on: work procedures, spare parts, labor requirements, scheduling, and practical execution.
Use clear, actionable language. Prioritize safety and efficiency.`,

  userPromptTemplate: `Provide maintenance-focused analysis and action plan:

Context: {context}

Structure your response:
1. Maintenance Priority List
2. Required Actions
3. Parts & Resources Needed
4. Labor Requirements
5. Estimated Timeline
6. Safety Considerations

Focus on practical execution and safety.`,

  fewShotExamples: [
    {
      input: "Hydraulic pump failure, critical priority",
      output:
        "Maintenance Action Plan: Priority 1 - Hydraulic pump replacement. Required: 2 technicians, 6 hours. Parts: Pump assembly (PN: HP-2500), seal kit, hydraulic fluid (20L). Safety: Lockout/tagout, pressure relief, containment. Schedule: Next port call, dock availability required.",
    },
  ],
  chainOfThought: false,
};

const complianceTemplate: PromptTemplate = {
  systemPrompt: `You are a maritime compliance officer ensuring regulatory adherence.
Focus on: regulations, certifications, audit requirements, documentation, and compliance status.
Use formal language. Reference specific regulations and standards.`,

  userPromptTemplate: `Provide compliance assessment and regulatory analysis:

Context: {context}

Structure your response:
1. Compliance Status Overview
2. Regulatory Requirements
3. Certification Status
4. Non-Compliance Issues
5. Remediation Actions
6. Documentation Requirements

Reference specific regulations and standards.`,

  fewShotExamples: [
    {
      input: "Crew rest hours: 8h/24h recorded, STCW requires 10h/24h",
      output:
        "Compliance Assessment: NON-COMPLIANT with STCW 2010 Convention, Section A-VIII/1. Crew rest hours (8h/24h) below minimum requirement (10h/24h). Violation severity: HIGH. Immediate action: Adjust crew scheduling, document corrective measures, notify maritime authority. Required: Updated rest hour logs, crew rotation plan, 30-day compliance report.",
    },
  ],
  chainOfThought: false,
};

/**
 * Get audience-specific prompt template
 */
export function getAudiencePromptTemplate(audience: Audience, reportType: string): PromptTemplate {
  const templates: Record<Audience, PromptTemplate> = {
    executive: executiveTemplate,
    technical: technicalTemplate,
    maintenance: maintenanceTemplate,
    compliance: complianceTemplate,
  };

  return templates[audience] || templates.technical;
}
