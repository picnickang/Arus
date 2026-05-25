import { useForm, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DataWindowPreset, DataWindowTier } from "./DataWindowPreset";
import { ModelTypeSelector } from "./ModelTypeSelector";
import { AdvancedOptionsFields } from "./AdvancedOptionsFields";
import { Loader2, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type ModelType = "lstm" | "random-forest" | "xgboost";
export type ModelObjective = "health" | "failure" | "rul";

const trainingConfigSchema = z.object({
  modelType: z.enum(["lstm", "random-forest", "xgboost"], {
    required_error: "Please select a model type",
  }),
  objective: z.enum(["health", "failure", "rul"], { required_error: "Please select an objective" }),
  equipmentScope: z.string().min(1, "Please select equipment scope"),
  dataWindow: z.enum(["bronze", "silver", "gold", "platinum"], {
    required_error: "Please select a data window",
  }),
  epochs: z.coerce.number().int().min(10).max(500).optional(),
  sequenceLength: z.coerce.number().int().min(5).max(50).optional(),
  learningRate: z.coerce.number().min(0.0001).max(0.1).optional(),
  numTrees: z.coerce.number().int().min(10).max(500).optional(),
  maxDepth: z.coerce.number().int().min(2).max(20).optional(),
  lstmUnits: z.coerce.number().int().min(16).max(256).optional(),
  dropoutRate: z.coerce.number().min(0).max(0.8).optional(),
  batchSize: z.coerce.number().int().min(8).max(128).optional(),
});

export type TrainingConfig = z.infer<typeof trainingConfigSchema>;

interface ModelTrainingFormProps {
  onSubmit: (config: TrainingConfig) => Promise<void>;
  equipmentTypes: string[];
  defaultValues?: Partial<TrainingConfig>;
  loading?: boolean;
  "data-testid"?: string;
}

const dataWindowPresets: Record<
  DataWindowTier,
  { days: number; label: string; description: string }
> = {
  bronze: { days: 90, label: "Bronze", description: "Quick training with 3 months of data" },
  silver: { days: 180, label: "Silver", description: "Balanced training with 6 months of data" },
  gold: { days: 365, label: "Gold", description: "Comprehensive training with 1 year of data" },
  platinum: { days: 730, label: "Platinum", description: "Maximum accuracy with 2+ years of data" },
};

const objectiveLabels: Record<ModelObjective, string> = {
  health: "Health Score Prediction",
  failure: "Failure Prediction",
  rul: "Remaining Useful Life (RUL)",
};

const defaultAdvanced: Partial<TrainingConfig> = {
  epochs: 100,
  sequenceLength: 10,
  learningRate: 0.001,
  numTrees: 100,
  maxDepth: 6,
  lstmUnits: 64,
  dropoutRate: 0.2,
  batchSize: 32,
};

export function ModelTrainingForm({
  onSubmit,
  equipmentTypes,
  defaultValues,
  loading = false,
  "data-testid": testId,
}: ModelTrainingFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const form = useForm<TrainingConfig, unknown, TrainingConfig>({
    resolver: zodResolver(trainingConfigSchema),
    defaultValues: {
      modelType: undefined,
      objective: undefined,
      equipmentScope: "",
      dataWindow: undefined,
      ...defaultAdvanced,
      ...defaultValues,
    } as DefaultValues<TrainingConfig>,
  });

  const selectedModelType = form.watch("modelType");

  const handleFormSubmit = async (data: TrainingConfig) => {
    await onSubmit(data);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleFormSubmit)}
        className="space-y-6"
        data-testid={testId}
      >
        {/* Model Type Selection */}
        <FormField
          control={form.control}
          name="modelType"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base font-semibold">Model Type</FormLabel>
              <FormDescription>Select the machine learning algorithm for training</FormDescription>
              <FormControl>
                <ModelTypeSelector value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Equipment Scope & Objective */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="equipmentScope"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Equipment Scope</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-equipment-scope">
                      <SelectValue placeholder="Select equipment type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="all">All Equipment Types</SelectItem>
                    {equipmentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Train on all equipment or specific type</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="objective"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Training Objective</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-objective">
                      <SelectValue placeholder="Select objective" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(Object.keys(objectiveLabels) as ModelObjective[]).map((obj) => (
                      <SelectItem key={obj} value={obj}>
                        {objectiveLabels[obj]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>What the model should predict</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Data Window Presets */}
        <FormField
          control={form.control}
          name="dataWindow"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base font-semibold">Training Data Window</FormLabel>
              <FormDescription>Select how much historical data to use for training</FormDescription>
              <FormControl>
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-4 md:overflow-x-visible">
                  {(Object.keys(dataWindowPresets) as DataWindowTier[]).map((tier) => {
                    const preset = dataWindowPresets[tier];
                    return (
                      <DataWindowPreset
                        key={tier}
                        tier={tier}
                        days={preset.days}
                        label={preset.label}
                        description={preset.description}
                        selected={field.value === tier}
                        onClick={() => field.onChange(tier)}
                      />
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Advanced Options */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-between"
              data-testid="toggle-advanced-options"
            >
              <span>Advanced Options</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  advancedOpen && "rotate-180"
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <AdvancedOptionsFields form={form} selectedModelType={selectedModelType} />
          </CollapsibleContent>
        </Collapsible>

        {/* Submit Button */}
        <div className="sticky bottom-0 bg-background p-4 border-t md:static md:p-0 md:border-0 -mx-4 md:mx-0">
          <Button
            type="submit"
            className="w-full md:w-auto"
            disabled={loading}
            data-testid="button-submit-training"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Starting Training..." : "Start Training"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
