import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ModelType, TrainingConfig } from "./ModelTrainingForm";

interface AdvancedOptionsFieldsProps {
  form: UseFormReturn<TrainingConfig>;
  selectedModelType: ModelType | undefined;
}

function NumberField({
  form,
  name,
  label,
  step,
  testId,
}: {
  form: UseFormReturn<TrainingConfig>;
  name: keyof TrainingConfig;
  label: string;
  step?: string;
  testId: string;
}) {
  const parseValue = step ? parseFloat : (v: string) => Number.parseInt(v);
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              step={step}
              {...field}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(parseValue(e.target.value))}
              data-testid={testId}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function AdvancedOptionsFields({ form, selectedModelType }: AdvancedOptionsFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 border rounded-lg bg-muted/30">
      {selectedModelType === "lstm" && (
        <>
          <NumberField form={form} name="epochs" label="Epochs" testId="input-epochs" />
          <NumberField form={form} name="lstmUnits" label="LSTM Units" testId="input-lstm-units" />
          <NumberField
            form={form}
            name="sequenceLength"
            label="Sequence Length"
            testId="input-sequence-length"
          />
          <NumberField
            form={form}
            name="dropoutRate"
            label="Dropout Rate"
            step="0.1"
            testId="input-dropout-rate"
          />
        </>
      )}

      {(selectedModelType === "random-forest" || selectedModelType === "xgboost") && (
        <>
          <NumberField
            form={form}
            name="numTrees"
            label="Number of Trees"
            testId="input-num-trees"
          />
          <NumberField form={form} name="maxDepth" label="Max Depth" testId="input-max-depth" />
        </>
      )}

      <NumberField
        form={form}
        name="learningRate"
        label="Learning Rate"
        step="0.001"
        testId="input-learning-rate"
      />
      <NumberField form={form} name="batchSize" label="Batch Size" testId="input-batch-size" />
    </div>
  );
}
