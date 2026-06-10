import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateDataset, useStartTrainingRun } from "@/features/ml-ai/hooks/useTrainingPipeline";
import {
  createDatasetSchema,
  startRunSchema,
  type CreateDatasetFormData,
  type StartRunFormData,
} from "./trainingPipelineSchemas";

export { PromoteDialog } from "./PromoteDialog";

const CREATE_DATASET_DEFAULTS: CreateDatasetFormData = {
  name: "",
  sourceType: "telemetry",
  description: "",
  labelColumn: "failure",
  rowCount: undefined,
};

export function CreateDatasetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useCreateDataset();
  const { toast } = useToast();

  const form = useForm<CreateDatasetFormData, unknown, CreateDatasetFormData>({
    resolver: zodResolver(createDatasetSchema),
    defaultValues: CREATE_DATASET_DEFAULTS,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (open) {
      form.reset(CREATE_DATASET_DEFAULTS);
    }
  }, [open, form]);

  const onSubmit = async (data: CreateDatasetFormData) => {
    try {
      await mutation.mutateAsync({
        name: data.name,
        sourceType: data.sourceType,
        ...(data.description && { description: data.description }),
        ...(data.labelColumn && { labelColumn: data.labelColumn }),
        ...(data.rowCount !== undefined && { rowCount: data.rowCount }),
      });
      toast({ title: "Dataset created successfully" });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to create dataset", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Training Dataset</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Name</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-dataset-name"
                      placeholder="e.g., Engine Telemetry Q4 2024"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sourceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Source Type</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-dataset-source-type"
                      placeholder="telemetry"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-dataset-description"
                      placeholder="Optional description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="labelColumn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label Column</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-dataset-label-column"
                        placeholder="failure"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rowCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Row Count</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-dataset-row-count"
                        type="number"
                        placeholder="10000"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-dataset"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-submit-dataset"
              >
                {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Dataset
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const START_RUN_DEFAULTS: StartRunFormData = {
  datasetId: "",
  learningRate: 0.001,
  epochs: 50,
  batchSize: 32,
};

export function StartRunDialog({
  open,
  onOpenChange,
  datasets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasets: Array<{ id: string; name: string; status?: string | null }>;
}) {
  const mutation = useStartTrainingRun();
  const { toast } = useToast();

  const form = useForm<StartRunFormData, unknown, StartRunFormData>({
    resolver: zodResolver(startRunSchema),
    defaultValues: START_RUN_DEFAULTS,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (open) {
      form.reset(START_RUN_DEFAULTS);
    }
  }, [open, form]);

  const onSubmit = async (data: StartRunFormData) => {
    try {
      await mutation.mutateAsync({
        datasetId: data.datasetId,
        hyperparameters: {
          learningRate: data.learningRate,
          epochs: data.epochs,
          batchSize: data.batchSize,
        },
      });
      toast({ title: "Training run started" });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to start training run", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Training Run</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="datasetId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Dataset</FormLabel>
                  {datasets.length > 0 ? (
                    <FormControl>
                      <select
                        data-testid="select-run-dataset"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        {...field}
                      >
                        <option value="">Select a dataset</option>
                        {datasets.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.status})
                          </option>
                        ))}
                      </select>
                    </FormControl>
                  ) : (
                    <FormControl>
                      <Input
                        data-testid="input-run-dataset-id"
                        placeholder="Enter dataset ID"
                        {...field}
                      />
                    </FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="learningRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Learning Rate</FormLabel>
                    <FormControl>
                      <Input data-testid="input-run-learning-rate" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="epochs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Epochs</FormLabel>
                    <FormControl>
                      <Input data-testid="input-run-epochs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="batchSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Batch Size</FormLabel>
                    <FormControl>
                      <Input data-testid="input-run-batch-size" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-run"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-run">
                {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Start Training
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
