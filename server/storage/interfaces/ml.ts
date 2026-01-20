import type {
  MlModel,
  InsertMlModel,
  AnomalyDetection,
  InsertAnomalyDetection,
  DigitalTwin,
  InsertDigitalTwin,
  InsertTwinScenario,
  TwinScenario,
} from "@shared/schema-runtime";

export interface MLModelFilters {
  equipmentId?: string;
  modelType?: string;
  status?: "training" | "active" | "inactive" | "archived";
  orgId?: string;
  limit?: number;
  offset?: number;
}

export interface AnomalyFilters {
  equipmentId?: string;
  sensorType?: string;
  severity?: string;
  startDate?: Date;
  endDate?: Date;
  acknowledged?: boolean;
  orgId?: string;
}

export interface IMLModelStorage {
  getMLModels(filters?: MLModelFilters): Promise<MlModel[]>;
  getMLModel(id: string, orgId?: string): Promise<MlModel | undefined>;
  createMLModel(model: InsertMlModel): Promise<MlModel>;
  updateMLModel(id: string, model: Partial<InsertMlModel>, orgId?: string): Promise<MlModel>;
  deleteMLModel(id: string, orgId?: string): Promise<void>;
  
  getActiveModelByEquipment(equipmentId: string, modelType: string, orgId?: string): Promise<MlModel | undefined>;
  getModelsByEquipment(equipmentId: string, orgId?: string): Promise<MlModel[]>;
  activateModel(id: string, orgId?: string): Promise<MlModel>;
  deactivateModel(id: string, orgId?: string): Promise<MlModel>;
  archiveModel(id: string, orgId?: string): Promise<MlModel>;
  
  recordModelAccuracy(id: string, accuracy: number, metadata?: Record<string, unknown>, orgId?: string): Promise<void>;
  getModelAccuracyHistory(id: string, days?: number, orgId?: string): Promise<Array<{ timestamp: Date; accuracy: number }>>;
}

export interface IAnomalyDetectionStorage {
  getAnomalies(filters?: AnomalyFilters): Promise<AnomalyDetection[]>;
  getAnomaly(id: string, orgId?: string): Promise<AnomalyDetection | undefined>;
  createAnomaly(anomaly: InsertAnomalyDetection): Promise<AnomalyDetection>;
  acknowledgeAnomaly(id: string, acknowledgedBy: string, orgId?: string): Promise<AnomalyDetection>;
  
  getRecentAnomalies(hours?: number, orgId?: string): Promise<AnomalyDetection[]>;
  getAnomaliesByEquipment(equipmentId: string, orgId?: string): Promise<AnomalyDetection[]>;
  getAnomalyStats(orgId?: string): Promise<{
    total: number;
    byEquipment: Record<string, number>;
    bySeverity: Record<string, number>;
    unacknowledged: number;
  }>;
}

export interface IDigitalTwinStorage {
  getDigitalTwins(orgId?: string): Promise<DigitalTwin[]>;
  getDigitalTwin(id: string, orgId?: string): Promise<DigitalTwin | undefined>;
  getDigitalTwinByEquipment(equipmentId: string, orgId?: string): Promise<DigitalTwin | undefined>;
  createDigitalTwin(twin: InsertDigitalTwin): Promise<DigitalTwin>;
  updateDigitalTwin(id: string, twin: Partial<InsertDigitalTwin>, orgId?: string): Promise<DigitalTwin>;
  deleteDigitalTwin(id: string, orgId?: string): Promise<void>;
  
  syncTwinState(id: string, state: Record<string, unknown>, orgId?: string): Promise<DigitalTwin>;
  
  getTwinScenarios(twinId: string, orgId?: string): Promise<TwinScenario[]>;
  createTwinScenario(scenario: InsertTwinScenario): Promise<TwinScenario>;
  runTwinScenario(scenarioId: string, parameters: Record<string, unknown>, orgId?: string): Promise<{
    results: Record<string, unknown>;
    executionTime: number;
  }>;
}

export interface IPredictionStorage {
  getPredictions(equipmentId: string, hours?: number, orgId?: string): Promise<Array<{
    timestamp: Date;
    sensorType: string;
    predictedValue: number;
    confidence: number;
    modelId: string;
  }>>;
  
  storePrediction(prediction: {
    equipmentId: string;
    sensorType: string;
    timestamp: Date;
    predictedValue: number;
    actualValue?: number;
    confidence: number;
    modelId: string;
    orgId: string;
  }): Promise<void>;
  
  comparePredictions(modelId: string, startDate: Date, endDate: Date, orgId?: string): Promise<{
    mse: number;
    mae: number;
    mape: number;
    sampleCount: number;
  }>;
}

export interface IMLJobStorage {
  createTrainingJob(job: {
    equipmentId?: string;
    modelType: string;
    hyperparameters?: Record<string, unknown>;
    orgId: string;
  }): Promise<{ jobId: string }>;
  
  getJobStatus(jobId: string, orgId?: string): Promise<{
    status: "pending" | "running" | "completed" | "failed";
    progress?: number;
    error?: string;
    result?: Record<string, unknown>;
  }>;
  
  cancelJob(jobId: string, orgId?: string): Promise<void>;
  
  getRecentJobs(limit?: number, orgId?: string): Promise<Array<{
    id: string;
    modelType: string;
    status: string;
    createdAt: Date;
    completedAt?: Date;
  }>>;
}
