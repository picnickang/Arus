import { useState } from "react";
import { TwinOverviewCard } from "./TwinOverviewCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useTwins,
  useTemplates,
  useCreateTemplate,
  useCreateTwin,
} from "@/features/digital-twin/hooks/useTwinApi";
import {
  useTwinFreshness,
  useRefreshTwin,
  useRefreshAllTwins,
  type TwinFreshnessInfo,
} from "@/features/digital-twin/hooks/useTwinFreshness";



export function OverviewTab() {
  const { data: twins, isLoading: twinsLoading } = useTwins();
  const { data: templates, isLoading: templatesLoading } = useTemplates();
  const { data: freshnessData, isLoading: freshnessLoading } = useTwinFreshness();
  const refreshTwin = useRefreshTwin();
  const refreshAll = useRefreshAllTwins();
  const createTemplate = useCreateTemplate();
  const createTwin = useCreateTwin();
  const { toast } = useToast();

  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState("engine");
  const [showCreateTwin, setShowCreateTwin] = useState(false);
  const [twinName, setTwinName] = useState("");
  const [twinEquipmentId, setTwinEquipmentId] = useState("");
  const [twinTemplateId, setTwinTemplateId] = useState("");

  const freshnessMap = new Map<string, TwinFreshnessInfo>();
  if (freshnessData) {
    for (const f of freshnessData) {
      freshnessMap.set(f.twinId, f);
    }
  }

  const handleRefreshTwin = async (twinId: string) => {
    try {
      await refreshTwin.mutateAsync(twinId);
      toast({ title: "Twin refreshed successfully" });
    } catch {
      toast({ title: "Failed to refresh twin", variant: "destructive" });
    }
  };

  const handleRefreshAll = async () => {
    try {
      await refreshAll.mutateAsync();
      toast({ title: "All twins refreshed" });
    } catch {
      toast({ title: "Failed to refresh twins", variant: "destructive" });
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateName || !templateType) {
      return;
    }
    try {
      await createTemplate.mutateAsync({
        name: templateName,
        equipmentType: templateType,
        expectedBehavior: {
          temperature: { intercept: 60, loadFactor: 0.3, ambientTempFactor: 0.1 },
          vibration: { nominalValue: 2.5 },
          pressure: { nominalValue: 4.2 },
        },
        operatingEnvelope: {
          temperature: { min: 40, max: 120 },
          vibration: { min: 0, max: 10 },
          pressure: { min: 2, max: 8 },
        },
        sensorMappings: {
          temperature: ["exhaust_temp", "coolant_temp"],
          vibration: ["vibration", "acceleration"],
          pressure: ["oil_pressure", "fuel_pressure"],
        },
      });
      toast({ title: "Template created" });
      setTemplateName("");
      setShowCreateTemplate(false);
    } catch {
      toast({ title: "Failed to create template", variant: "destructive" });
    }
  };

  const handleCreateTwin = async () => {
    if (!twinName || !twinEquipmentId || !twinTemplateId) {
      return;
    }
    try {
      await createTwin.mutateAsync({
        name: twinName,
        equipmentId: twinEquipmentId,
        templateId: twinTemplateId,
        status: "active",
      });
      toast({ title: "Twin created" });
      setTwinName("");
      setTwinEquipmentId("");
      setShowCreateTwin(false);
    } catch {
      toast({ title: "Failed to create twin", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Templates</h3>
          <p className="text-sm text-muted-foreground">
            Reusable twin blueprints per equipment type
          </p>
        </div>
        <Button
          data-testid="button-show-create-template"
          variant="outline"
          size="sm"
          onClick={() => setShowCreateTemplate(!showCreateTemplate)}
        >
          <Plus className="w-4 h-4 mr-1" /> New Template
        </Button>
      </div>

      {showCreateTemplate && (
        <Card data-testid="card-create-template">
          <CardContent className="pt-4 space-y-3">
            <div className="flex gap-3">
              <input
                data-testid="input-template-name"
                type="text"
                placeholder="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="flex h-10 w-60 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                data-testid="input-template-type"
                type="text"
                placeholder="Equipment type (e.g. engine)"
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
                className="flex h-10 w-60 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button
                data-testid="button-create-template"
                onClick={handleCreateTemplate}
                disabled={createTemplate.isPending || !templateName}
              >
                {createTemplate.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {templatesLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (templates?.length ?? 0) > 0 && templates ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id} data-testid={`card-template-${t.id}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <CardDescription>{t.equipmentType}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {t.description || `${t.equipmentType || "General"} template`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="text-no-templates">
          No templates yet. Create one to get started.
        </p>
      )}

      <div className="border-t pt-6 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Asset Twins</h3>
          <p className="text-sm text-muted-foreground">
            Digital twin instances linked to equipment
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            data-testid="button-refresh-all-twins"
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={refreshAll.isPending}
          >
            {refreshAll.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            Refresh All
          </Button>
          <Button
            data-testid="button-show-create-twin"
            variant="outline"
            size="sm"
            onClick={() => setShowCreateTwin(!showCreateTwin)}
          >
            <Plus className="w-4 h-4 mr-1" /> New Twin
          </Button>
        </div>
      </div>

      {showCreateTwin && (
        <Card data-testid="card-create-twin">
          <CardContent className="pt-4 space-y-3">
            <div className="flex gap-3 flex-wrap">
              <input
                data-testid="input-twin-name"
                type="text"
                placeholder="Twin name"
                value={twinName}
                onChange={(e) => setTwinName(e.target.value)}
                className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                data-testid="input-twin-equipment-id"
                type="text"
                placeholder="Equipment ID"
                value={twinEquipmentId}
                onChange={(e) => setTwinEquipmentId(e.target.value)}
                className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <select
                data-testid="select-twin-template"
                value={twinTemplateId}
                onChange={(e) => setTwinTemplateId(e.target.value)}
                className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select template...</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Button
                data-testid="button-create-twin"
                onClick={handleCreateTwin}
                disabled={createTwin.isPending || !twinName || !twinEquipmentId || !twinTemplateId}
              >
                {createTwin.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {twinsLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (twins?.length ?? 0) > 0 && twins ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {twins.map((tw) => (
            <TwinOverviewCard
              key={tw.id}
              twin={tw}
              freshness={freshnessMap.get(tw.id)}
              onRefresh={handleRefreshTwin}
              isRefreshing={refreshTwin.isPending}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="text-no-twins">
          No asset twins created yet.
        </p>
      )}
    </div>
  );
}

