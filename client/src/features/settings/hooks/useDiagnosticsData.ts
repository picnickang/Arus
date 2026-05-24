import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertTriangle, XCircle, Loader2, TestTube } from "lucide-react";

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: CheckResult;
    telemetry: CheckResult;
    memory: CheckResult;
    services: ServiceStatus[];
  };
}

export interface CheckResult {
  status: "pass" | "warn" | "fail";
  responseTimeMs?: number;
  message?: string;
  details?: {
    bufferUtilization?: number;
    utilizationPercent?: number;
    heapUsedMB?: number;
    [key: string]: unknown;
  };
}

export interface ServiceStatus {
  name: string;
  status: "running" | "stopped" | "error";
  lastHealthCheck?: string;
  details?: Record<string, unknown>;
}

export interface DiagnosticsConfig {
  telemetry?: {
    batchIntervalMs?: number;
    bufferSize?: number;
    evictionPercent?: number;
    maxRetries?: number;
  };
  environment?: {
    nodeEnv?: string;
    deploymentMode?: string;
  };
  features?: {
    dualDatabase?: boolean;
    mlPredictions?: boolean;
    fmccIntegration?: boolean;
  };
  [key: string]: unknown;
}

export interface SystemMetrics {
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    externalMB: number;
    utilizationPercent: number;
  };
  uptime: number;
  nodeVersion: string;
  timestamp: string;
}

export interface TelemetryStats {
  batchWriter: {
    bufferSize: number;
    totalQueued: number;
    totalFlushed: number;
    totalEvicted: number;
    totalErrors: number;
    totalDropped: number;
    lastFlushTime: string | null;
    lastFlushDurationMs: number;
    lastFlushCount: number;
    avgFlushDurationMs: number;
    isRunning: boolean;
  };
  health: { bufferUtilization: number; evictionRate: number; writeSuccessRate: number };
  timestamp: string;
}

export interface TestRunResult {
  status: "running" | "passed" | "failed" | "not_run";
  output?: string;
  startedAt?: string;
  completedAt?: string;
  message?: string;
}

export interface TestSuite {
  name: string;
  description: string;
  file: string;
  category: string;
  runnable: boolean;
  lastRun: TestRunResult | null;
}

export function useDiagnosticsData() {
  const { toast } = useToast();
  const [selectedOutput, setSelectedOutput] = useState<{ name: string; output: string } | null>(
    null
  );

  const { data: health, isLoading: healthLoading } = useQuery<HealthCheckResult>({
    queryKey: ["/api/diagnostics/health"],
    staleTime: 30000,
    refetchInterval: 60000,
  });
  const { data: metrics, isLoading: metricsLoading } = useQuery<SystemMetrics>({
    queryKey: ["/api/diagnostics/metrics"],
    staleTime: 15000,
    refetchInterval: 60000,
  });
  const { data: telemetryStats } = useQuery<TelemetryStats>({
    queryKey: ["/api/diagnostics/telemetry/stats"],
    staleTime: 10000,
    refetchInterval: 15000,
  });
  const { data: testSuites, refetch: refetchTestSuites } = useQuery<{ suites: TestSuite[] }>({
    queryKey: ["/api/diagnostics/test-suites"],
    staleTime: 5000,
    refetchInterval: 10000,
  });
  const { data: config } = useQuery<DiagnosticsConfig>({
    queryKey: ["/api/diagnostics/config"],
  });

  const runTestMutation = useMutation({
    mutationFn: async (suiteName: string) =>
      apiRequest("POST", `/api/diagnostics/test-suites/${suiteName}/run`),
    onSuccess: (_, suiteName) => {
      toast({ title: "Test Started", description: `Test suite '${suiteName}' is now running` });
      refetchTestSuites();
    },
    onError: (error: Error, suiteName) => {
      toast({
        title: "Failed to start test",
        description: error?.message || `Could not start test suite '${suiteName}'`,
        variant: "destructive",
      });
    },
  });

  const getTestStatusIcon = (status: string | undefined) => {
    switch (status) {
      case "passed":
        return CheckCircle;
      case "failed":
        return XCircle;
      case "running":
        return Loader2;
      default:
        return TestTube;
    }
  };

  const getTestStatusBadgeVariant = (
    status: string | undefined
  ): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      passed: "default",
      failed: "destructive",
      running: "secondary",
    };
    if (!status || status === "not_run") {
      return "outline";
    }
    return variants[status] || "outline";
  };

  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case "pass":
      case "healthy":
        return CheckCircle;
      case "warn":
      case "degraded":
        return AlertTriangle;
      case "fail":
      case "unhealthy":
        return XCircle;
      default:
        return undefined;
    }
  };

  const getStatusBadgeVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pass: "default",
      healthy: "default",
      running: "default",
      warn: "secondary",
      degraded: "secondary",
      fail: "destructive",
      unhealthy: "destructive",
      stopped: "outline",
      error: "destructive",
    };
    return variants[status] || "outline";
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return {
    health,
    healthLoading,
    metrics,
    metricsLoading,
    telemetryStats,
    testSuites,
    config,
    selectedOutput,
    setSelectedOutput,
    runTestMutation,
    refetchTestSuites,
    getTestStatusIcon,
    getTestStatusBadgeVariant,
    getStatusIcon,
    getStatusBadgeVariant,
    formatUptime,
  };
}
