import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Brain, TreeDeciduous, Zap, LucideIcon } from "lucide-react";
import type { ModelType } from "./ModelTrainingForm";

interface ModelTypeConfig {
  icon: LucideIcon;
  label: string;
  description: string;
  color: string;
  bgColor: string;
}

const modelTypeConfig: Record<ModelType, ModelTypeConfig> = {
  lstm: {
    icon: Brain,
    label: "LSTM Neural Network",
    description: "Best for time-series patterns and sequential data",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  "random-forest": {
    icon: TreeDeciduous,
    label: "Random Forest",
    description: "Robust ensemble method for classification",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  xgboost: {
    icon: Zap,
    label: "XGBoost",
    description: "High-performance gradient boosting",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
};

interface ModelTypeSelectorProps {
  value: ModelType | undefined;
  onChange: (type: ModelType) => void;
}

export function ModelTypeSelector({ value, onChange }: ModelTypeSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {(Object.keys(modelTypeConfig) as ModelType[]).map((type) => {
        const config = modelTypeConfig[type];
        const Icon = config.icon;
        const isSelected = value === type;

        return (
          <Card
            key={type}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              isSelected && "ring-2 ring-primary"
            )}
            onClick={() => onChange(type)}
            data-testid={`model-type-${type}`}
          >
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", config.bgColor)}>
                  <Icon className={cn("h-5 w-5", config.color)} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{config.label}</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{config.description}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
