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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePromoteRun } from "@/features/ml-ai/hooks/useTrainingPipeline";
import { promoteSchema, type PromoteFormData } from "./trainingPipelineSchemas";

const PROMOTE_DEFAULTS: PromoteFormData = { modelId: "", version: "", changelog: "" };

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

  const form = useForm<PromoteFormData, unknown, PromoteFormData>({
    resolver: zodResolver(promoteSchema),
    defaultValues: PROMOTE_DEFAULTS,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (runId) {
      form.reset(PROMOTE_DEFAULTS);
    }
  }, [runId, form]);

  const onSubmit = async (data: PromoteFormData) => {
    if (!runId) {
      return;
    }
    try {
      await mutation.mutateAsync({
        runId,
        modelId: data.modelId,
        version: data.version,
        ...(data.changelog && { changelog: data.changelog }),
      });
      toast({ title: "Model version promoted successfully" });
      onClose();
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="modelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Target Model</FormLabel>
                  {models.length > 0 ? (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="input-promote-model-id">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {models.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} ({m.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      <Input
                        data-testid="input-promote-model-id"
                        placeholder="Target model ID"
                        {...field}
                      />
                    </FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="version"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Version</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-promote-version"
                      placeholder="e.g., 2.1.0"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="changelog"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Changelog</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-promote-changelog"
                      placeholder="Optional changelog notes"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel-promote"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-submit-promote"
              >
                {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Promote
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
