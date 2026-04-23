/**
 * Digital Twin Service - Modular vessel simulation and monitoring
 * Aggregates types, physics calculations, and simulation scenarios
 */

import { EventEmitter } from "node:events";
import { dbTelemetryStorage } from "../repositories.js";
import { db } from "../db.js";
import { digitalTwins, twinSimulations, visualizationAssets } from "@shared/schema-runtime";
import type { DigitalTwin, TwinSimulation, VisualizationAsset } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("DigitalTwin:Index");

import type { VesselSpecifications, PhysicsModel, TwinState, SimulationScenario } from "./types.js";
import {
  validateStateConsistency,
  calculateTwinAccuracy,
  assimilateTelemetryData,
} from "./physics-calculations.js";
import { simulatePhysics, analyzeSimulationResults } from "./simulation-scenarios.js";

export * from "./types.js";
export * from "./physics-calculations.js";
export * from "./simulation-scenarios.js";

export class DigitalTwinService extends EventEmitter {
  private activeTwins: Map<string, DigitalTwin> = new Map();
  private simulationQueue: Map<string, TwinSimulation> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private enabled: boolean = true;

  constructor() {
    super();
    logger.info("[Digital Twin] Service initialized");
    this.loadActiveTwins();
    this.startRealTimeUpdates();
  }

  async createDigitalTwin(
    vesselId: string,
    twinType: string,
    name: string,
    specifications: VesselSpecifications,
    physicsModel?: PhysicsModel
  ): Promise<DigitalTwin> {
    logger.info(`[Digital Twin] Creating twin for vessel ${vesselId}: ${name}`);
    const defaultPhysicsModel: PhysicsModel = {
      hydrodynamics: { hullResistance: 0.02, waveMaking: 0.015, frictionCoefficient: 0.003 },
      propulsion: { efficiency: 0.85, thrustCurve: [0, 0.25, 0.5, 0.75, 1], fuelConsumption: 0.2 },
      machinery: {
        mainEngines: [
          { id: "MAIN_ENGINE_01", power: specifications.enginePower, efficiency: 0.42 },
        ],
        auxiliaryPower: specifications.enginePower * 0.15,
        heatExchangers: [{ id: "HE_01", capacity: 1000 }],
      },
      environmental: { windResistance: 0.01, currentEffect: 0.5, waveHeight: 2 },
    };
    const initialState: TwinState = {
      position: { latitude: 0, longitude: 0 },
      speed: 0,
      heading: 0,
      draft: specifications.displacement / (specifications.length * specifications.beam * 0.7),
      trim: 0,
      list: 0,
      machinery: {
        engines: { MAIN_ENGINE_01: { rpm: 0, load: 0, temperature: 85 } },
        generators: { GEN_01: { load: 0, voltage: 440, frequency: 60 } },
        pumps: { COOLING_PUMP_01: { flow: 0, pressure: 0, status: "standby" } },
      },
      cargo: { totalWeight: 0, distribution: [] },
      fuel: {
        totalCapacity: specifications.displacement * 0.15,
        currentLevel: specifications.displacement * 0.12,
        consumptionRate: 0,
      },
      crew: { onboard: 20, positions: {} },
    };
    const digitalTwin = await db
      .insert(digitalTwins)
      .values({
        vesselId,
        twinType,
        name,
        specifications,
        physicsModel: physicsModel || defaultPhysicsModel,
        currentState: initialState,
        simulationConfig: { updateInterval: 60, realTimeSync: true, dataAssimilation: true },
        validationStatus: "active",
        accuracy: 0.85,
        metadata: {
          createdBy: "system",
          modelVersion: "2.0",
          lastCalibration: new Date().toISOString(),
        },
      })
      .returning();
    const twin = digitalTwin[0];
    this.activeTwins.set(twin.id, twin);
    await this.createDefaultVisualizationAssets(twin.id, specifications);
    this.emit("twin_created", twin);
    return twin;
  }

  async updateTwinState(twinId: string, telemetryData: Record<string, any>): Promise<void> {
    const twin = this.activeTwins.get(twinId);
    if (!twin || !twin.currentState) {
      return;
    }
    try {
      const currentState = twin.currentState as TwinState;
      const updatedState = assimilateTelemetryData(currentState, telemetryData);
      const validatedState = validateStateConsistency(updatedState);
      await db
        .update(digitalTwins)
        .set({
          currentState: validatedState,
          lastUpdate: new Date(),
          accuracy: calculateTwinAccuracy(telemetryData, validatedState),
        })
        .where(eq(digitalTwins.id, twinId));
      twin.currentState = validatedState;
      twin.lastUpdate = new Date();
      this.activeTwins.set(twinId, twin);
      this.emit("twin_state_updated", {
        twinId,
        previousState: currentState,
        newState: validatedState,
        telemetryData,
      });
      await this.checkCriticalConditions(twinId, validatedState);
    } catch (error) {
      logger.error(`[Digital Twin] Error updating state for ${twinId}:`, undefined, error);
      this.emit("twin_error", {
        twinId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to update digital twin state for ${twinId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async runSimulation(
    twinId: string,
    scenarioName: string,
    scenario: SimulationScenario
  ): Promise<TwinSimulation> {
    const twin = this.activeTwins.get(twinId);
    if (!twin) {
      throw new Error(`Digital twin ${twinId} not found`);
    }
    const simulation = await db
      .insert(twinSimulations)
      .values({
        digitalTwinId: twinId,
        scenarioName,
        scenarioType: scenario.scenarioType,
        inputParameters: scenario,
        status: "running",
        progressPercentage: 0,
        metadata: { startedBy: "system", estimatedDuration: scenario.duration, priority: "normal" },
      })
      .returning();
    const sim = simulation[0];
    this.simulationQueue.set(sim.id, sim);
    setImmediate(() => this.processSimulation(sim.id, twin, scenario));
    this.emit("simulation_started", sim);
    return sim;
  }

  private async processSimulation(
    simulationId: string,
    twin: DigitalTwin,
    scenario: SimulationScenario
  ): Promise<void> {
    try {
      const physicsModel = twin.physicsModel as PhysicsModel;
      const initialState = twin.currentState as TwinState;
      const results: any[] = [];
      const totalSteps = Math.floor((scenario.duration * 60) / scenario.timeStep);
      let currentStep = 0;
      while (currentStep < totalSteps) {
        const timeElapsed = currentStep * scenario.timeStep;
        const simulatedState = simulatePhysics(initialState, physicsModel, scenario, timeElapsed);
        results.push({
          time: timeElapsed,
          state: simulatedState,
          conditions: scenario.environmentalConditions,
        });
        currentStep++;
        await db
          .update(twinSimulations)
          .set({ progressPercentage: (currentStep / totalSteps) * 100 })
          .where(eq(twinSimulations.id, simulationId));
        if (currentStep % 10 === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      }
      const analysis = analyzeSimulationResults(results, scenario);
      await db
        .update(twinSimulations)
        .set({
          status: "completed",
          progressPercentage: 100,
          endTime: new Date(),
          simulationResults: results,
          recommendedActions: analysis.recommendations,
          costBenefitAnalysis: analysis.costBenefit,
        })
        .where(eq(twinSimulations.id, simulationId));
      this.simulationQueue.delete(simulationId);
      this.emit("simulation_completed", { simulationId, results, analysis });
    } catch (error) {
      await db
        .update(twinSimulations)
        .set({
          status: "failed",
          endTime: new Date(),
          metadata: {
            error: error instanceof Error ? error.message : String(error),
            failedAt: new Date().toISOString(),
          },
        })
        .where(eq(twinSimulations.id, simulationId));
      this.simulationQueue.delete(simulationId);
      this.emit("simulation_failed", { simulationId, error });
    }
  }

  private async checkCriticalConditions(twinId: string, state: TwinState): Promise<void> {
    const alerts: string[] = [];
    for (const [engineId, engine] of Object.entries(state.machinery.engines)) {
      if (engine.temperature > 120) {
        alerts.push(`Engine ${engineId} overheating: ${engine.temperature}°C`);
      }
      if (engine.load > 0.95) {
        alerts.push(`Engine ${engineId} overload: ${(engine.load * 100).toFixed(1)}%`);
      }
    }

    if (state.fuel.currentLevel < state.fuel.totalCapacity * 0.1) {
      alerts.push(`Low fuel warning: ${state.fuel.currentLevel.toFixed(1)} tons remaining`);
    }
    if (Math.abs(state.list) > 15) {
      alerts.push(`Excessive list: ${state.list.toFixed(1)}°`);
    }
    if (alerts.length > 0) {
      this.emit("critical_condition", { twinId, alerts, state });
    }
  }

  private async createDefaultVisualizationAssets(
    twinId: string,
    specifications: VesselSpecifications
  ): Promise<void> {
    const assets = [
      {
        assetType: "3d_model",
        name: `${specifications.vesselType}_hull_model`,
        filePath: `/models/vessels/${specifications.vesselType}_hull.gltf`,
        fileFormat: "gltf",
        targetPlatform: "web",
        lodLevel: 2,
      },
      {
        assetType: "texture",
        name: `${specifications.vesselType}_hull_texture`,
        filePath: `/textures/vessels/${specifications.vesselType}_hull_diffuse.png`,
        fileFormat: "png",
        targetPlatform: "web",
        textureResolution: "2048x2048",
      },
      {
        assetType: "ar_overlay",
        name: `machinery_space_overlay`,
        filePath: `/ar/machinery_space_markers.json`,
        fileFormat: "json",
        targetPlatform: "ar",
      },
    ];
    for (const asset of assets) {
      await db
        .insert(visualizationAssets)
        .values({
          ...asset,
          fileSizeBytes: 1024 * 1024,
          boundingBox: { min: [-50, -10, -200], max: [50, 30, 200] },
          compressionType: "gzip",
          optimizationLevel: "medium",
          metadata: { twinId, autoGenerated: true },
        });
    }
  }

  private async loadActiveTwins(): Promise<void> {
    if (!db) {
      logger.warn("[Digital Twin] Disabled: database not initialized");
      this.enabled = false;
      return;
    }
    try {
      const twins = await db
        .select()
        .from(digitalTwins)
        .where(eq(digitalTwins.validationStatus, "active"));
      for (const twin of twins) {
        this.activeTwins.set(twin.id, twin);
      }
      logger.info(`[Digital Twin] Loaded ${twins.length} active digital twins`);
    } catch (error) {
      logger.error("[Digital Twin] Error loading active twins:", undefined, error);
    }
  }

  private startRealTimeUpdates(): void {
    this.updateInterval = setInterval(async () => {
      await this.processRealTimeUpdates();
    }, 60 * 1000);
    logger.info("[Digital Twin] Real-time update scheduler started");
  }

  private async processRealTimeUpdates(): Promise<void> {
    try {
      for (const [twinId, twin] of this.activeTwins.entries()) {
        const telemetryData = await this.getLatestTelemetryForVessel(twin.vesselId);
        if (Object.keys(telemetryData).length > 0) {
          await this.updateTwinState(twinId, telemetryData);
        }
      }
    } catch (error) {
      logger.error("[Digital Twin] Error processing real-time updates:", undefined, error);
    }
  }

  private async getLatestTelemetryForVessel(_vesselId: string): Promise<Record<string, any>> {
    try {
      const latestTelemetry = await dbTelemetryStorage.getLatestTelemetryReadings(undefined, 50);
      const vesselTelemetry: Record<string, any> = {};
      for (const reading of latestTelemetry) {
        if (reading.equipmentId && reading.sensorType) {
          vesselTelemetry[reading.sensorType] = reading.value;
        }
      }
      return vesselTelemetry;
    } catch (error) {
      logger.error("[Digital Twin] Error getting vessel telemetry:", undefined, error);
      return {};
    }
  }

  async getDigitalTwins(vesselId?: string): Promise<DigitalTwin[]> {
    const query = db.select().from(digitalTwins);
    if (vesselId) {
      return query.where(eq(digitalTwins.vesselId, vesselId));
    }
    return query.orderBy(sql`${digitalTwins.createdAt} DESC`);
  }

  async getSimulations(twinId: string, limit: number = 50): Promise<TwinSimulation[]> {
    return db
      .select()
      .from(twinSimulations)
      .where(eq(twinSimulations.digitalTwinId, twinId))
      .orderBy(sql`${twinSimulations.startTime} DESC`)
      .limit(limit);
  }

  async getVisualizationAssets(assetType?: string): Promise<VisualizationAsset[]> {
    const query = db.select().from(visualizationAssets);
    if (assetType) {
      return query.where(eq(visualizationAssets.assetType, assetType));
    }
    return query.orderBy(sql`${visualizationAssets.createdAt} DESC`);
  }

  async updateFuelEfficiency(
    twinId: string,
    orgId: string,
    telemetryData: Record<string, any>
  ): Promise<void> {
    try {
      const [twin] = await db
        .select()
        .from(digitalTwins)
        .where(eq(digitalTwins.id, twinId))
        .limit(1);
      if (!twin) {
        logger.warn(`[DigitalTwin] Twin ${twinId} not found`);
        return;
      }
      const { predictFuelConsumption } = await import("../digital-twin-fuel-calc.js");
      const specs = (twin.specifications as any) ?? {};
      const characteristics = {
        displacement: specs.displacement ?? 1000,
        length: specs.length ?? 50,
        beam: specs.beam ?? 10,
        draft: specs.draft ?? 4,
        enginePower: specs.enginePower ?? 500,
        specificFuelConsumption: specs.specificFuelConsumption ?? 210,
        hullCondition: specs.hullCondition ?? 0.85,
        propellerEfficiency: specs.propellerEfficiency ?? 0.65,
      };
      const state = {
        speed: telemetryData.speed ?? 10,
        engineRpm: telemetryData.engineRpm ?? 1500,
        engineLoad: telemetryData.engineLoad ?? 60,
        fuelRate: telemetryData.fuelRate,
        propellerPitch: telemetryData.propellerPitch,
        trim: telemetryData.trim,
      };
      const conditions = {
        windSpeed: telemetryData.windSpeed,
        windDirection: telemetryData.windDirection,
        waveHeight: telemetryData.waveHeight,
        seaState: telemetryData.seaState,
      };
      const daysInService = twin.lastUpdate
        ? Math.floor((Date.now() - new Date(twin.lastUpdate).getTime()) / 86400000)
        : 30;
      const prediction = predictFuelConsumption(state, characteristics, conditions, daysInService);
      const updatedState = {
        ...((twin.currentState as any) ?? {}),
        fuel: {
          ...((twin.currentState as any)?.fuel ?? {}),
          predictedRate: prediction.predictedFuelRate,
          efficiency: prediction.efficiency,
          confidence: prediction.confidence,
          lastUpdated: new Date().toISOString(),
        },
      };
      await db
        .update(digitalTwins)
        .set({
          currentState: updatedState,
          fuelEfficiency: prediction.efficiency.toString(),
          lastUpdate: new Date(),
        })
        .where(eq(digitalTwins.id, twinId));
      logger.info(`[DigitalTwin] Updated fuel efficiency for ${twinId}: ${prediction.efficiency.toFixed(1)}%`);
    } catch (error) {
      logger.error(`[DigitalTwin] Failed to update fuel efficiency:`, undefined, error);
    }
  }

  getHealthStatus(): { status: string; features: string[]; stats: any } {
    return {
      status: "operational",
      features: [
        "vessel_digital_twins",
        "physics_based_simulation",
        "real_time_state_sync",
        "maintenance_scenario_modeling",
        "failure_impact_analysis",
        "route_optimization",
        "3d_visualization_assets",
        "ar_maintenance_procedures",
        "enhanced_fuel_efficiency_calc",
      ],
      stats: {
        activeTwins: this.activeTwins.size,
        runningSimulations: this.simulationQueue.size,
        realTimeUpdates: !!this.updateInterval,
      },
    };
  }

  async cleanup(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.activeTwins.clear();
    this.simulationQueue.clear();
    logger.info("[Digital Twin] Service cleanup completed");
  }
}

export const digitalTwinService = new DigitalTwinService();
