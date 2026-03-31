import { z } from "zod";
import { registerTool } from "./registry";
import { createOpenAIClient } from "../../../openai/client";
import { resolveFile } from "../infrastructure/file-registry";
import fs from "fs";

registerTool({
  name: "analyzeImage",
  description: "Analyze an uploaded image using AI vision. Useful for assessing equipment condition, reading gauges, identifying parts, or inspecting visible damage in marine equipment photos. Requires a fileId from a previously uploaded image.",
  parameters: {
    type: "object",
    properties: {
      fileId: { type: "string", description: "The file ID of the uploaded image (from the file upload response)" },
      analysisType: {
        type: "string",
        enum: ["condition_assessment", "gauge_reading", "part_identification", "damage_inspection", "general"],
        description: "Type of analysis to perform on the image",
      },
    },
    required: ["fileId"],
  },
  inputSchema: z.object({
    fileId: z.string().uuid(),
    analysisType: z.enum(["condition_assessment", "gauge_reading", "part_identification", "damage_inspection", "general"]).optional().default("general"),
  }),
  requiresApproval: false,
  async execute(input: Record<string, unknown>, ctx) {
    const fileId = input.fileId as string;
    const analysisType = (input.analysisType as string) || "general";

    const record = await resolveFile(fileId, ctx.orgId);
    if (!record) {
      return { error: "Image file not found or access denied" };
    }

    if (!record.mimetype.startsWith("image/")) {
      return { error: `File is not an image (type: ${record.mimetype})` };
    }

    const client = await createOpenAIClient();
    if (!client) {
      return { error: "OpenAI is not configured for image analysis" };
    }

    const base64 = fs.readFileSync(record.storedPath, "base64");
    const dataUrl = `data:${record.mimetype};base64,${base64}`;

    const prompts: Record<string, string> = {
      condition_assessment: "You are a marine equipment inspection specialist. Analyze this image and provide: 1) Overall condition rating (good/fair/poor/critical), 2) Visible wear or degradation, 3) Maintenance recommendations, 4) Urgency level.",
      gauge_reading: "You are a marine instrumentation specialist. Read any gauges, meters, or displays visible in this image. Provide: 1) Identified instruments, 2) Current readings with units, 3) Whether readings are within normal range, 4) Any anomalies.",
      part_identification: "You are a marine equipment specialist. Identify the equipment, components, or parts shown in this image. Provide: 1) Equipment/part identification, 2) Likely manufacturer or type, 3) Condition assessment, 4) Related marine systems.",
      damage_inspection: "You are a marine damage assessment specialist. Analyze this image for damage. Provide: 1) Type of damage observed (corrosion, cracks, wear, leaks, etc.), 2) Severity (minor/moderate/severe/critical), 3) Affected components, 4) Recommended repair actions, 5) Safety concerns.",
      general: "You are a marine engineering specialist. Analyze this image in the context of marine vessel operations. Describe what you see, identify any equipment or components, assess their condition, and note anything relevant to maintenance or safety.",
    };

    const structuredPrompt = `${prompts[analysisType] || prompts.general}

IMPORTANT: Return your analysis as a JSON object with these fields:
{
  "conditionRating": "good" | "fair" | "poor" | "critical" | null,
  "identifiedComponents": ["list of identified equipment/components"],
  "visibleDamage": ["list of visible damage or wear observations"],
  "recommendations": ["list of maintenance/repair recommendations"],
  "urgencyLevel": "low" | "medium" | "high" | "critical" | null,
  "summary": "Brief overall summary paragraph"
}
Only include fields relevant to the analysis type. Return valid JSON only.`;

    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: structuredPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `Analyze this image (${record.filename}):` },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
        max_tokens: 1500,
        response_format: { type: "json_object" },
      });

      const rawContent = response.choices[0]?.message?.content || "{}";
      let structured: Record<string, unknown>;
      try {
        structured = JSON.parse(rawContent);
      } catch {
        structured = { summary: rawContent };
      }

      return {
        fileId,
        filename: record.filename,
        analysisType,
        conditionRating: structured.conditionRating || null,
        identifiedComponents: structured.identifiedComponents || [],
        visibleDamage: structured.visibleDamage || [],
        recommendations: structured.recommendations || [],
        urgencyLevel: structured.urgencyLevel || null,
        summary: structured.summary || "",
        tokensUsed: response.usage?.total_tokens || 0,
      };
    } catch (err) {
      return { error: `Image analysis failed: ${err instanceof Error ? err.message : "unknown error"}` };
    }
  },
});

registerTool({
  name: "analyzeSpreadsheet",
  description: "Parse and analyze an uploaded CSV file. Generates summary statistics for numeric columns and can answer questions about specific rows, columns, or data patterns. Requires a fileId from a previously uploaded CSV.",
  parameters: {
    type: "object",
    properties: {
      fileId: { type: "string", description: "The file ID of the uploaded CSV file (from the file upload response)" },
      question: { type: "string", description: "Optional specific question about the data" },
    },
    required: ["fileId"],
  },
  inputSchema: z.object({
    fileId: z.string().uuid(),
    question: z.string().optional(),
  }),
  requiresApproval: false,
  async execute(input: Record<string, unknown>, ctx) {
    const fileId = input.fileId as string;
    const question = input.question as string | undefined;

    const record = await resolveFile(fileId, ctx.orgId);
    if (!record) {
      return { error: "File not found or access denied" };
    }

    const csvTypes = ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
    if (!csvTypes.includes(record.mimetype)) {
      return { error: `File is not a spreadsheet (type: ${record.mimetype})` };
    }

    try {
      const csvText = fs.readFileSync(record.storedPath, "utf-8");
      const Papa = (await import("papaparse")).default;
      const parsed = Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
      const rows = parsed.data as Record<string, unknown>[];
      const headers = parsed.meta.fields || [];

      const columnStats: Record<string, Record<string, unknown>> = {};
      for (const col of headers) {
        const vals = rows.map(r => r[col]);
        const numericVals = vals.filter((v): v is number => typeof v === "number");
        const stringVals = vals.filter((v): v is string => typeof v === "string");

        if (numericVals.length > 0) {
          const sorted = [...numericVals].sort((a, b) => a - b);
          const sum = numericVals.reduce((a, b) => a + b, 0);
          columnStats[col] = {
            type: "numeric",
            count: numericVals.length,
            nullCount: vals.filter(v => v == null).length,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            mean: Number((sum / numericVals.length).toFixed(4)),
            median: Number(sorted[Math.floor(sorted.length / 2)].toFixed(4)),
            sum: Number(sum.toFixed(4)),
          };
        } else if (stringVals.length > 0) {
          const uniqueVals = [...new Set(stringVals)];
          columnStats[col] = {
            type: "categorical",
            count: stringVals.length,
            nullCount: vals.filter(v => v == null).length,
            uniqueValues: uniqueVals.length,
            topValues: uniqueVals.slice(0, 10),
          };
        }
      }

      const maxDataRows = question ? Math.min(rows.length, 200) : 5;
      const dataRows = rows.slice(0, maxDataRows);

      const result: Record<string, unknown> = {
        fileId,
        filename: record.filename,
        rowCount: rows.length,
        columnCount: headers.length,
        columns: headers,
        columnStats,
        sampleRows: dataRows,
        parseErrors: parsed.errors.length,
      };

      if (question) {
        result.question = question;

        const qLower = question.toLowerCase();
        const matchingRows: Record<string, unknown>[] = [];
        for (const row of rows) {
          for (const col of headers) {
            const val = row[col];
            if (val != null && String(val).toLowerCase().includes(qLower)) {
              matchingRows.push(row);
              break;
            }
          }
          if (matchingRows.length >= 50) break;
        }
        if (matchingRows.length > 0) {
          result.matchingRows = matchingRows;
          result.matchCount = matchingRows.length;
        }

        result.instruction = "Answer the user's question using the data provided. The sampleRows contain up to 200 rows of raw data, and matchingRows contains rows where any cell matches query terms.";
      }

      return result;
    } catch (err) {
      return { error: `Spreadsheet analysis failed: ${err instanceof Error ? err.message : "unknown error"}` };
    }
  },
});
