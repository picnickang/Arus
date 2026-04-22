import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, AlertTriangle, Wrench, Package, Users, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Preferences {
  maintenance: boolean;
  predictions: boolean;
  crew: boolean;
  inventory: boolean;
  alerts: boolean;
  minSeverity: "info" | "warning" | "critical";
}

const CATEGORIES = [
  {
    key: "predictions" as const,
    label: "Failure Predictions",
    description: "High-risk equipment failure predictions",
    icon: AlertTriangle,
  },
  {
    key: "maintenance" as const,
    label: "Overdue Maintenance",
    description: "Maintenance tasks that are past due",
    icon: Wrench,
  },
  {
    key: "alerts" as const,
    label: "Critical Alerts",
    description: "Unacknowledged critical equipment alerts",
    icon: Shield,
  },
  {
    key: "crew" as const,
    label: "Crew Certifications",
    description: "Expiring crew certifications within 30 days",
    icon: Users,
  },
  {
    key: "inventory" as const,
    label: "Low Inventory",
    description: "Parts below minimum stock levels",
    icon: Package,
  },
];

export function SuggestionPreferences() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery<Preferences>({
    queryKey: ["/api/agent/suggestion-preferences"],
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Preferences>) =>
      apiRequest("PUT", "/api/agent/suggestion-preferences", updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/suggestion-preferences"] });
      toast({ title: "Preferences updated" });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  const currentPrefs: Preferences = prefs || {
    maintenance: true,
    predictions: true,
    crew: true,
    inventory: true,
    alerts: true,
    minSeverity: "info",
  };

  return (
    <Card data-testid="card-suggestion-preferences">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-5 w-5" />
          AI Suggestion Preferences
        </CardTitle>
        <CardDescription>
          Control which types of AI suggestions you receive. The agent evaluates these conditions
          periodically and creates actionable notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.key}
                className="flex items-center justify-between gap-4"
                data-testid={`pref-toggle-${cat.key}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="text-sm font-medium">{cat.label}</Label>
                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                  </div>
                </div>
                <Switch
                  checked={currentPrefs[cat.key]}
                  onCheckedChange={(checked) => updateMutation.mutate({ [cat.key]: checked })}
                  data-testid={`switch-${cat.key}`}
                />
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t">
          <Label className="text-sm font-medium">Minimum Severity</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Only show suggestions at or above this severity level
          </p>
          <Select
            value={currentPrefs.minSeverity}
            onValueChange={(v) =>
              updateMutation.mutate({ minSeverity: v as Preferences["minSeverity"] })
            }
          >
            <SelectTrigger className="w-40" data-testid="select-min-severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info & above</SelectItem>
              <SelectItem value="warning">Warning & above</SelectItem>
              <SelectItem value="critical">Critical only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
