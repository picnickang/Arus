import { apiRequest } from "@/lib/queryClient";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

export interface DigitalTwin {
  id: string;
  vesselId: string;
  twinType: string;
  name: string;
  specifications: Record<string, unknown>;
  currentState: Record<string, unknown>;
  validationStatus: string;
  accuracy: number;
  lastUpdate: string;
}

export interface TwinSimulation {
  id: string;
  scenarioName: string;
  scenarioType: string;
  status: string;
  progressPercentage: number;
  startTime: string;
  endTime?: string;
}

export function useDigitalTwinData() {
  const [selectedTwin, setSelectedTwin] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"3d" | "dashboard" | "simulation">("dashboard");
  const [isSimulating, setIsSimulating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: twins = [], isLoading: twinsLoading } = useQuery<DigitalTwin[]>({
    queryKey: ["/api/digital-twins"],
    staleTime: 60000,
    refetchInterval: 60000,
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["/api/digital-twins", selectedTwin, "simulations"],
    enabled: !!selectedTwin,
    staleTime: 10000,
    refetchInterval: isSimulating ? 10000 : 30000,
  });

  const selectedTwinData = useMemo(
    () => twins.find((t: DigitalTwin) => t.id === selectedTwin),
    [twins, selectedTwin]
  );

  const initializeViewer = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    canvas.width = 800;
    canvas.height = 600;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.moveTo(centerX - 150, centerY + 50);
    ctx.lineTo(centerX - 120, centerY - 30);
    ctx.lineTo(centerX + 120, centerY - 30);
    ctx.lineTo(centerX + 150, centerY + 50);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeRect(centerX - 80, centerY - 60, 160, 30);
    ctx.strokeRect(centerX - 50, centerY - 90, 100, 30);
    if (selectedTwinData?.currentState?.['machinery']) {
      const machinery = selectedTwinData.currentState['machinery'] as {
        engines?: Record<string, { temperature?: number }>;
        generators?: Record<string, { voltage?: number }>;
      };
      ctx.fillStyle = (machinery.engines?.['MAIN_ENGINE_01']?.temperature ?? 0) > 100 ? "#ef4444" : "#22c55e";
      ctx.fillRect(centerX - 20, centerY - 10, 40, 20);
      ctx.fillStyle = (machinery.generators?.['GEN_01']?.voltage ?? 0) > 0 ? "#22c55e" : "#ef4444";
      ctx.fillRect(centerX + 40, centerY - 40, 20, 15);
    }
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px system-ui";
    ctx.fillText("Main Engine", centerX - 30, centerY + 15);
    ctx.fillText("Generator", centerX + 45, centerY - 20);
    ctx.fillText(`Speed: ${selectedTwinData?.currentState?.['speed'] || 0} knots`, 20, 30);
    ctx.fillText(`Heading: ${selectedTwinData?.currentState?.['heading'] || 0}°`, 20, 50);
  }, [selectedTwinData]);

  useEffect(() => {
    if (viewMode === "3d" && canvasRef.current && selectedTwinData) {
      initializeViewer();
    }
  }, [viewMode, selectedTwinData, initializeViewer]);

  const getScenarioParameters = useCallback((scenarioType: string) => {
    switch (scenarioType) {
      case "maintenance":
        return {
          maintenance: { maintenanceAction: "overhaul", duration: 480, degradationRate: 0.02 },
        };
      case "failure":
        return { failure: { component: "main_engine", failureTime: 60, severity: "high" } };
      case "optimization":
        return { optimization: { targetSpeed: 10, targetEfficiency: 0.92 } };
      default:
        return {};
    }
  }, []);

  const startSimulation = useCallback(
    async (scenarioType: string) => {
      if (!selectedTwin) {
        return;
      }
      const scenario = {
        scenarioType,
        parameters: getScenarioParameters(scenarioType),
        duration: 240,
        timeStep: 5,
        environmentalConditions: {
          seaState: 3,
          windSpeed: 15,
          windDirection: 180,
          visibility: 10,
          temperature: 20,
        },
      };
      try {
        setIsSimulating(true);
        await apiRequest("POST", `/api/digital-twins/${selectedTwin}/simulate`, {
          scenarioName: `${scenarioType}_simulation_${Date.now()}`,
          scenario,
        });
      } catch (error) {
        console.error("Failed to start simulation:", error);
      } finally {
        setIsSimulating(false);
      }
    },
    [selectedTwin, getScenarioParameters]
  );

  const formatState = useCallback(
    (
      state: {
        speed?: number;
        heading?: number;
        fuel?: { currentLevel?: number; totalCapacity?: number };
        crew?: { onboard?: number };
      } | null
    ) => {
      if (!state) {
        return {};
      }
      return {
        speed: `${state.speed || 0} knots`,
        heading: `${state.heading || 0}°`,
        fuel: `${state.fuel?.currentLevel || 0}/${state.fuel?.totalCapacity || 0} tons`,
        crew: `${state.crew?.onboard || 0} crew members`,
      };
    },
    []
  );

  return {
    selectedTwin,
    setSelectedTwin,
    viewMode,
    setViewMode,
    isSimulating,
    canvasRef,
    twins,
    twinsLoading,
    simulations,
    selectedTwinData,
    initializeViewer,
    startSimulation,
    formatState,
  };
}
