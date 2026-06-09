import { ConfidenceDetector } from "../../server/services/rag/confidence";

describe("ConfidenceDetector", () => {
  it("scores well-supported maritime answers as high confidence without a recommendation", () => {
    const detector = new ConfidenceDetector();

    const result = detector.evaluateConfidence(
      "What maintenance is required for the port main engine cooling pump?",
      [
        {
          content: "Port main engine cooling pump maintenance requires seal inspection.",
          score: 0.92,
        },
        {
          content: "Main engine cooling pump planned maintenance includes bearing checks.",
          score: 0.88,
        },
        {
          content: "Cooling pump maintenance intervals are documented by the chief engineer.",
          score: 0.81,
        },
        {
          content: "Vessel engine cooling pump alarms should be reviewed before overhaul.",
          score: 0.79,
        },
        {
          content: "Pump work orders should include operating hours and vibration readings.",
          score: 0.84,
        },
      ],
      450
    );

    expect(result.level).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(0.7);
    expect(result.recommendation).toBeUndefined();
    expect(result.factors.map((factor) => factor.name)).toEqual([
      "chunk_count",
      "retrieval_score",
      "query_coverage",
      "source_diversity",
      "response_length",
    ]);
  });

  it("flags unanswered or weakly matched questions with actionable recommendations", () => {
    const detector = new ConfidenceDetector();

    const noEvidence = detector.evaluateConfidence(
      "Who approved the ballast water discharge permit?",
      [],
      24
    );
    const weakRetrieval = detector.evaluateConfidence("Explain starboard crane fault reset", [
      { content: "Galley refrigerator inventory checklist", score: 0.15 },
      { content: "Crew travel booking note", score: 0.2 },
    ]);

    expect(noEvidence.level).toBe("low");
    expect(noEvidence.recommendation).toBe(
      "Consider uploading more relevant documentation to the knowledge base."
    );
    expect(weakRetrieval.level).toBe("low");
    expect(weakRetrieval.recommendation).toMatch(/not be well covered/i);
  });

  it("creates, scopes, acknowledges, and suppresses low-confidence alerts", async () => {
    const detector = new ConfidenceDetector({ alertOnLowConfidence: true });
    const received: unknown[] = [];
    detector.onAlert((alert) => received.push(alert));

    const lowConfidence = detector.evaluateConfidence("unknown pump trip history", []);
    const highConfidence = detector.evaluateConfidence("pump", [
      { content: "pump pump pump", score: 0.95 },
      { content: "pump maintenance", score: 0.95 },
      { content: "pump alarm", score: 0.95 },
    ]);

    const ignored = await detector.createAlert("pump", highConfidence, "org-a");
    const alert = await detector.createAlert(
      "unknown pump trip history",
      lowConfidence,
      "org-a",
      "c1"
    );
    await detector.createAlert("other tenant", lowConfidence, "org-b");

    expect(ignored).toBeNull();
    expect(alert).toMatchObject({
      queryText: "unknown pump trip history",
      orgId: "org-a",
      conversationId: "c1",
      acknowledged: false,
    });
    expect(received).toHaveLength(2);
    expect(detector.getAlerts("org-a")).toEqual([alert]);
    expect(detector.getAlerts("org-b")).toHaveLength(1);

    expect(detector.acknowledgeAlert(alert!.id)).toBe(true);
    expect(detector.acknowledgeAlert("missing-alert")).toBe(false);
    expect(detector.getAlerts("org-a")).toEqual([]);
    expect(detector.getAlerts("org-a", true)).toEqual([
      expect.objectContaining({ acknowledged: true }),
    ]);

    detector.updateConfig({ alertOnLowConfidence: false });
    expect(detector.getConfig().alertOnLowConfidence).toBe(false);
    await expect(detector.createAlert("disabled", lowConfidence, "org-a")).resolves.toBeNull();
  });
});
