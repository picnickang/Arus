/**
 * Legacy narrative summary service shim.
 */

export interface NarrativeInput {
  [k: string]: unknown;
}

export interface NarrativeSummary {
  summary: string;
  highlights: string[];
  generatedAt: string;
}

export class NarrativeSummaryService {
  async generate(_input: NarrativeInput): Promise<NarrativeSummary> {
    return {
      summary: "Narrative summary service is not configured.",
      highlights: [],
      generatedAt: new Date().toISOString(),
    };
  }
}
