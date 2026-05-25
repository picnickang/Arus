import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateDataset,
  useStartTrainingRun,
  usePromoteRun,
} from "@/features/ml-ai/hooks/useTrainingPipeline";

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1";

export function CreateDatasetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useCreateDataset();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    sourceType: "telemetry",
    description: "",
    labelColumn: "failure",
    rowCount: "",
  });

  const reset = () =>
    setForm({
      name: "",
      sourceType: "telemetry",
      description: "",
      labelColumn: "failure",
      rowCount: "",
    });

  const handleSubmit = async () => {
    try {
      await mutation.mutateAsync({
        name: form.name,
        sourceType: form.sourceType,
        ...(form.description && { description: form.description }),
        ...(form.labelColumn && { labelColumn: form.labelColumn }),
        ...(form.rowCount && { rowCount: parseInt(form.rowCount) }),
      });
      toast({ title: "Dataset created successfully" });
      onOpenChange(false);
      reset();
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
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              data-testid="input-dataset-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Engine Telemetry Q4 2024"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Source Type</label>
            <input
              data-testid="input-dataset-source-type"
              type="text"
              value={form.sourceType}
              onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
              placeholder="telemetry"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <input
              data-testid="input-dataset-description"
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Label Column</label>
              <input
                data-testid="input-dataset-label-column"
                type="text"
                value={form.labelColumn}
                onChange={(e) => setForm({ ...form, labelColumn: e.target.value })}
                placeholder="failure"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Row Count</label>
              <input
                data-testid="input-dataset-row-count"
                type="number"
                value={form.rowCount}
                onChange={(e) => setForm({ ...form, rowCount: e.target.value })}
                placeholder="10000"
                className={inputCls}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-dataset"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.name || !form.sourceType || mutation.isPending}
            data-testid="button-submit-dataset"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Create Dataset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  const [form, setForm] = useState({
    datasetId: "",
    learningRate: "0.001",
    epochs: "50",
    batchSize: "32",
  });

  const handleSubmit = async () => {
    try {
      await mutation.mutateAsync({
        datasetId: form.datasetId,
        hyperparameters: {
          learningRate: parseFloat(form.learningRate),
          epochs: parseInt(form.epochs),
          batchSize: parseInt(form.batchSize),
        },
      });
      toast({ title: "Training run started" });
      onOpenChange(false);
      setForm({ datasetId: "", learningRate: "0.001", epochs: "50", batchSize: "32" });
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
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Dataset</label>
            {datasets.length > 0 ? (
              <select
                data-testid="select-run-dataset"
                value={form.datasetId}
                onChange={(e) => setForm({ ...form, datasetId: e.target.value })}
                className={inputCls}
              >
                <option value="">Select a dataset</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.status})
                  </option>
                ))}
              </select>
            ) : (
              <input
                data-testid="input-run-dataset-id"
                type="text"
                value={form.datasetId}
                onChange={(e) => setForm({ ...form, datasetId: e.target.value })}
                placeholder="Enter dataset ID"
                className={inputCls}
              />
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">Learning Rate</label>
              <input
                data-testid="input-run-learning-rate"
                type="text"
                value={form.learningRate}
                onChange={(e) => setForm({ ...form, learningRate: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Epochs</label>
              <input
                data-testid="input-run-epochs"
                type="text"
                value={form.epochs}
                onChange={(e) => setForm({ ...form, epochs: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Batch Size</label>
              <input
                data-testid="input-run-batch-size"
                type="text"
                value={form.batchSize}
                onChange={(e) => setForm({ ...form, batchSize: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-run"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.datasetId || mutation.isPending}
            data-testid="button-submit-run"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Start Training
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PromoteDialog({
  runId,
  onClose,
  models,
}: {
  runId: string | null;
  onClose: () => void;
  models: Array<{ id: string; name: string; type?: string | null }>;
}) {
  const mutation = usePromoteRun();
  const { toast } = useToast();
  const [form, setForm] = useState({ modelId: "", version: "", changelog: "" });

  const handleSubmit = async () => {
    if (!runId) {
      return;
    }
    try {
      await mutation.mutateAsync({
        runId,
        modelId: form.modelId,
        version: form.version,
        ...(form.changelog && { changelog: form.changelog }),
      });
      toast({ title: "Model version promoted successfully" });
      onClose();
      setForm({ modelId: "", version: "", changelog: "" });
    } catch {
      toast({ title: "Failed to promote model version", variant: "destructive" });
    }
  };

  return (
    <Dialog open={!!runId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote to Model Version</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Target Model</label>
            {models.length > 0 ? (
              <Select
                value={form.modelId}
                onValueChange={(v) => setForm({ ...form, modelId: v })}
              >
                <SelectTrigger data-testid="input-promote-model-id" className="mt-1">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <input
                data-testid="input-promote-model-id"
                type="text"
                value={form.modelId}
                onChange={(e) => setForm({ ...form, modelId: e.target.value })}
                placeholder="Target model ID"
                className={inputCls}
              />
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Version</label>
            <input
              data-testid="input-promote-version"
              type="text"
              value={form.version}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
              placeholder="e.g., 2.1.0"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Changelog</label>
            <input
              data-testid="input-promote-changelog"
              type="text"
              value={form.changelog}
              onChange={(e) => setForm({ ...form, changelog: e.target.value })}
              placeholder="Optional changelog notes"
              className={inputCls}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-promote">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.modelId || !form.version || mutation.isPending}
            data-testid="button-submit-promote"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Promote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
