import { useEffect, useState } from "react";
import { useParams, useLocation, useSearch, Link } from "wouter";
import { IntelligenceLayout } from "@/components/intelligence/IntelligenceLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertTriangle, ChevronRight } from "lucide-react";
import { useEquipmentHub } from "@/hooks/useEquipmentHub";
import { QuickWorkOrderSheet } from "@/components/work-orders/QuickWorkOrderSheet";
import {
  riskColor,
  riskBadgeVariant,
  healthStroke,
  HealthRing,
  MiniSparkline,
  DARK_TABS_LIST,
  DARK_TABS_TRIGGER,
} from "./equipment-hub/shared";
import { ActionBar } from "./equipment-hub/ActionBar";
import { OverviewTab } from "./equipment-hub/OverviewTab";
import { WorkPartsTab } from "./equipment-hub/WorkPartsTab";
import { DiagnosticsTab } from "./equipment-hub/DiagnosticsTab";
import { HistoryTab } from "./equipment-hub/HistoryTab";
import { ContextTab } from "./equipment-hub/ContextTab";

const VALID_HUB_TABS = ["overview", "work", "diagnostics", "history", "context"] as const;

export default function EquipmentHub() {
  const params = useParams<{ equipmentId: string }>();
  const equipmentId = params.equipmentId || "";
  const [, navigate] = useLocation();
  const search = useSearch();
  const [quickWoOpen, setQuickWoOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("overview");

  useEffect(() => {
    document.title = "Equipment Hub | ARUS";
  }, []);

  useEffect(() => {
    const tab = new URLSearchParams(search).get("tab");
    if (tab && (VALID_HUB_TABS as readonly string[]).includes(tab)) {
      setActiveTab(tab);
    }
  }, [search]);

  const {
    data,
    isLoading,
    error,
    runDiagnostic,
    isDiagnosticPending,
    acknowledgeAnomaly,
    isAcknowledgePending,
    crew,
    isCrewLoading,
    assignWork,
    isAssignPending,
  } = useEquipmentHub(equipmentId);

  if (isLoading) {
    return (
      <IntelligenceLayout>
        <div className="min-h-screen flex items-center justify-center" data-testid="loading-state">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
            <p className="text-sm text-slate-500">Loading equipment data...</p>
          </div>
        </div>
      </IntelligenceLayout>
    );
  }

  if (error || !data) {
    return (
      <IntelligenceLayout>
        <div className="min-h-screen flex items-center justify-center" data-testid="error-state">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-500">Failed to load equipment data</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => navigate("/equipment-intelligence")}
              data-testid="button-back-to-fleet"
            >
              Back to Fleet
            </Button>
          </div>
        </div>
      </IntelligenceLayout>
    );
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    navigate(`/equipment/${equipmentId}?tab=${tab}`, { replace: true });
  };

  return (
    <IntelligenceLayout>
      <div
        className="max-w-6xl mx-auto px-4 md:px-6 py-4 space-y-5"
        data-testid="equipment-hub-page"
      >
        {/* Breadcrumb */}
        <nav
          className="flex items-center gap-1.5 text-xs text-slate-500"
          data-testid="equipment-breadcrumb"
        >
          <Link href="/equipment-intelligence" className="hover:text-slate-300 transition-colors">
            Fleet
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-400">{data.vessel}</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-200 font-medium">{data.name}</span>
        </nav>

        {/* Hero: identity, health, prediction stats — always above the fold */}
        <div className="flex flex-col md:flex-row gap-5 items-start" data-testid="hub-header">
          <div className="flex items-center gap-4 flex-1">
            {data.health == null ? (
              <div
                className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-4 border-slate-700/40 text-center"
                data-testid="health-ring-empty"
              >
                <span className="text-sm font-bold text-slate-500">—</span>
                <span className="text-[8px] uppercase tracking-wider text-slate-600">No score</span>
              </div>
            ) : (
              <HealthRing value={data.health} size={80} stroke={7} />
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-slate-100" data-testid="equipment-name">
                  {data.name}
                </h1>
                <Badge
                  variant={riskBadgeVariant(data.risk)}
                  className="text-[10px] uppercase"
                  data-testid="risk-badge"
                >
                  {data.risk}
                </Badge>
              </div>
              <div className="text-xs text-slate-500">
                {data.vessel} · {data.type}
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <div>
                  <span className="text-slate-600">RUL</span>{" "}
                  <span className={`font-bold ${riskColor(data.risk)}`} data-testid="rul-value">
                    {data.rul == null ? "—" : `${data.rul}d`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">Confidence</span>{" "}
                  <span className="font-bold text-slate-200" data-testid="confidence-value">
                    {data.confidence == null ? "—" : `${data.confidence}%`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">Trend</span>{" "}
                  <span
                    className={`font-semibold ${data.trend === "declining" ? "text-red-400" : data.trend === "improving" ? "text-green-400" : "text-slate-400"}`}
                  >
                    {data.trend === "declining"
                      ? "↘ Declining"
                      : data.trend === "improving"
                        ? "↗ Improving"
                        : "→ Stable"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <MiniSparkline
            data={data.telemetry}
            color={healthStroke(data.health ?? 100)}
            w={140}
            h={40}
          />
        </div>

        <ActionBar
          data={data}
          crew={crew}
          isCrewLoading={isCrewLoading}
          acknowledgeAnomaly={acknowledgeAnomaly}
          isAcknowledgePending={isAcknowledgePending}
          assignWork={assignWork}
          isAssignPending={isAssignPending}
          onQuickWo={() => setQuickWoOpen(true)}
          navigate={navigate}
        />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className={`flex w-full overflow-x-auto ${DARK_TABS_LIST}`}>
            <TabsTrigger value="overview" className={DARK_TABS_TRIGGER} data-testid="tab-overview">
              Overview
            </TabsTrigger>
            <TabsTrigger value="work" className={DARK_TABS_TRIGGER} data-testid="tab-work-parts">
              Work & Parts ({data.workOrders.length + data.serviceOrders.length})
            </TabsTrigger>
            <TabsTrigger
              value="diagnostics"
              className={DARK_TABS_TRIGGER}
              data-testid="tab-hub-diagnostics"
            >
              Diagnostics
            </TabsTrigger>
            <TabsTrigger value="history" className={DARK_TABS_TRIGGER} data-testid="tab-history">
              History
            </TabsTrigger>
            <TabsTrigger value="context" className={DARK_TABS_TRIGGER} data-testid="tab-context">
              Context
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab data={data} />
          </TabsContent>
          <TabsContent value="work" className="mt-4">
            <WorkPartsTab data={data} />
          </TabsContent>
          <TabsContent value="diagnostics" className="mt-4">
            <DiagnosticsTab
              data={data}
              runDiagnostic={runDiagnostic}
              isDiagnosticPending={isDiagnosticPending}
            />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <HistoryTab data={data} />
          </TabsContent>
          <TabsContent value="context" className="mt-4">
            <ContextTab data={data} />
          </TabsContent>
        </Tabs>
      </div>

      <QuickWorkOrderSheet
        open={quickWoOpen}
        onClose={() => setQuickWoOpen(false)}
        vesselId={data.vesselId ?? undefined}
        defaultEquipmentId={data.id}
      />
    </IntelligenceLayout>
  );
}
