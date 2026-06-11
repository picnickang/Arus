import { describe, expect, it } from "@jest/globals";
import * as logbooks from "../../shared/schema/logbooks";
import * as mlAdvanced from "../../shared/schema/ml-analytics-advanced";

describe("shared schema barrels", () => {
  it("keeps logbook tables, constants, and insert schemas on the public module", () => {
    expect(logbooks.deckLogDaily).toBeDefined();
    expect(logbooks.deckLogHourly).toBeDefined();
    expect(logbooks.deckLogEvents).toBeDefined();
    expect(logbooks.engineLogDaily).toBeDefined();
    expect(logbooks.engineLogHourly).toBeDefined();
    expect(logbooks.engineLogEvents).toBeDefined();
    expect(logbooks.deckLogHourlyAutoFill).toBeDefined();
    expect(logbooks.fuelEmissionsLog).toBeDefined();
    expect(logbooks.vesselTrackLog).toBeDefined();
    expect(logbooks.conditionLogSummary).toBeDefined();
    expect(logbooks.DECK_LOG_EVENT_TYPES.WEATHER_OBSERVATION).toBe("WEATHER_OBSERVATION");
    expect(logbooks.ENGINE_LOG_EVENT_TYPES.MAINTENANCE_START).toBe("MAINTENANCE_START");
    expect(typeof logbooks.insertDeckLogDailySchema.parse).toBe("function");
    expect(typeof logbooks.insertEngineLogDailySchema.parse).toBe("function");
    expect(typeof logbooks.insertFuelEmissionsLogSchema.parse).toBe("function");
  });

  it("keeps advanced ML tables and insert schemas on the public module", () => {
    expect(mlAdvanced.modelPerformanceValidations).toBeDefined();
    expect(mlAdvanced.predictionFeedback).toBeDefined();
    expect(mlAdvanced.vibrationFeatures).toBeDefined();
    expect(mlAdvanced.rulModels).toBeDefined();
    expect(mlAdvanced.pdmBaseline).toBeDefined();
    expect(mlAdvanced.realTimePredictions).toBeDefined();
    expect(mlAdvanced.featureImportances).toBeDefined();
    expect(mlAdvanced.digitalTwins).toBeDefined();
    expect(mlAdvanced.modelRegistry).toBeDefined();
    expect(mlAdvanced.inferenceRuns).toBeDefined();
    expect(mlAdvanced.predictionOutcomes).toBeDefined();
    expect(typeof mlAdvanced.insertModelPerformanceValidationSchema.parse).toBe("function");
    expect(typeof mlAdvanced.insertRealTimePredictionSchema.parse).toBe("function");
    expect(typeof mlAdvanced.insertDigitalTwinSchema.parse).toBe("function");
    expect(typeof mlAdvanced.insertPredictionOutcomeSchema.parse).toBe("function");
  });
});
