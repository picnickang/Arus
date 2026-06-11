import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sliders, Save, RotateCcw, Gauge, Thermometer, Droplets, Zap } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface OperatingParameter {
  id: string;
  name: string;
  value: number;
  unit: string;
  minValue: number;
  maxValue: number;
  category: string;
}

interface OperatingParametersPageProps {
  embedded?: boolean;
}

export default function OperatingParametersPage({ embedded }: OperatingParametersPageProps) {
  const { toast } = useToast();
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});

  const { data: parameters, isLoading } = useQuery<OperatingParameter[]>({
    queryKey: ["/api/admin/operating-parameters"],
    retry: 1,
    staleTime: 60000,
  });

  const defaultParameters: OperatingParameter[] = [
    {
      id: "1",
      name: "Engine RPM Warning",
      value: 2200,
      unit: "RPM",
      minValue: 1500,
      maxValue: 3000,
      category: "engine",
    },
    {
      id: "2",
      name: "Engine RPM Critical",
      value: 2800,
      unit: "RPM",
      minValue: 2000,
      maxValue: 3500,
      category: "engine",
    },
    {
      id: "3",
      name: "Oil Temperature Warning",
      value: 95,
      unit: "C",
      minValue: 80,
      maxValue: 120,
      category: "temperature",
    },
    {
      id: "4",
      name: "Oil Temperature Critical",
      value: 110,
      unit: "C",
      minValue: 90,
      maxValue: 130,
      category: "temperature",
    },
    {
      id: "5",
      name: "Coolant Temperature Warning",
      value: 90,
      unit: "C",
      minValue: 70,
      maxValue: 100,
      category: "temperature",
    },
    {
      id: "6",
      name: "Fuel Pressure Min",
      value: 35,
      unit: "PSI",
      minValue: 20,
      maxValue: 50,
      category: "fuel",
    },
    {
      id: "7",
      name: "Battery Voltage Min",
      value: 11.5,
      unit: "V",
      minValue: 10,
      maxValue: 14,
      category: "electrical",
    },
    {
      id: "8",
      name: "Battery Voltage Max",
      value: 14.4,
      unit: "V",
      minValue: 13,
      maxValue: 16,
      category: "electrical",
    },
  ];

  const params = parameters || defaultParameters;

  const saveMutation = useMutation({
    mutationFn: async (updates: Record<string, number>) => {
      return apiRequest("/api/admin/operating-parameters", {
        method: "PATCH",
        body: JSON.stringify({ updates }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operating-parameters"] });
      setEditedValues({});
      toast({
        title: "Parameters saved",
        description: "Operating parameters have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save parameters. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleValueChange = (id: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setEditedValues((prev) => ({ ...prev, [id]: numValue }));
    }
  };

  const handleSave = () => {
    if (Object.keys(editedValues).length > 0) {
      saveMutation.mutate(editedValues);
    }
  };

  const handleReset = () => {
    setEditedValues({});
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "engine":
        return <Gauge className="h-4 w-4" />;
      case "temperature":
        return <Thermometer className="h-4 w-4" />;
      case "fuel":
        return <Droplets className="h-4 w-4" />;
      case "electrical":
        return <Zap className="h-4 w-4" />;
      default:
        return <Sliders className="h-4 w-4" />;
    }
  };

  const groupedParams = params.reduce(
    (acc, param) => {
      let bucket = acc[param.category];
      if (!bucket) {
        bucket = [];
        acc[param.category] = bucket;
      }
      bucket.push(param);
      return acc;
    },
    {} as Record<string, OperatingParameter[]>
  );

  const hasChanges = Object.keys(editedValues).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-params-title">
            {embedded ? "Operating Parameters" : "Operating Parameters Configuration"}
          </h1>
          <p className="text-muted-foreground">
            Configure threshold values for equipment monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges}
            data-testid="button-reset-params"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            data-testid="button-save-params"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            You have unsaved changes. Click "Save Changes" to apply them.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.entries(groupedParams).map(([category, categoryParams]) => (
          <Card key={category}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <div>
                <CardTitle className="text-base capitalize">{category} Parameters</CardTitle>
                <CardDescription>
                  {categoryParams.length} parameter{categoryParams.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
              {getCategoryIcon(category)}
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryParams.map((param) => {
                const currentValue = editedValues[param.id] ?? param.value;
                const isEdited = param.id in editedValues;

                return (
                  <div key={param.id} className="space-y-2" data-testid={`param-${param.id}`}>
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`param-${param.id}`} className="text-sm">
                        {param.name}
                      </Label>
                      {isEdited && (
                        <Badge variant="secondary" className="text-xs">
                          Modified
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`param-${param.id}`}
                        type="number"
                        value={currentValue}
                        onChange={(e) => handleValueChange(param.id, e.target.value)}
                        min={param.minValue}
                        max={param.maxValue}
                        step={param.unit === "V" ? 0.1 : 1}
                        className="w-24"
                        data-testid={`input-param-${param.id}`}
                      />
                      <span className="text-sm text-muted-foreground">{param.unit}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        Range: {param.minValue} - {param.maxValue}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
