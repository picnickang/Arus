import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  runOptimizationFormSchema,
  RUN_OPTIMIZATION_DEFAULTS,
  type RunOptimizationFormData,
} from "./runOptimizationSchema";

type OptimizationData = ReturnType<typeof import("@/features/maintenance").useOptimizationData>;

export function RunDialog({ o }: { o: OptimizationData }) {
  const form = useForm<RunOptimizationFormData, unknown, RunOptimizationFormData>({
    resolver: zodResolver(runOptimizationFormSchema),
    defaultValues: RUN_OPTIMIZATION_DEFAULTS,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (o.runDialogOpen) {
      form.reset(RUN_OPTIMIZATION_DEFAULTS);
    }
  }, [o.runDialogOpen, form]);

  const onSubmit = (data: RunOptimizationFormData) => {
    if (o.selectedConfiguration) {
      o.runOptimizationMutation.mutate({
        configId: o.selectedConfiguration,
        timeHorizon: data.timeHorizon,
      });
    }
  };

  return (
    <Dialog open={o.runDialogOpen} onOpenChange={o.setRunDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run Optimization</DialogTitle>
          <DialogDescription>Execute optimization with selected configuration</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Configuration</Label>
              <p className="text-sm text-muted-foreground">
                {o.configurations?.find((c) => c.id === o.selectedConfiguration)?.name}
              </p>
            </div>
            <FormField
              control={form.control}
              name="timeHorizon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Time Horizon (Days)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      data-testid="input-run-time-horizon"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => o.setRunDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={o.runOptimizationMutation.isPending}
                data-testid="button-start-optimization"
              >
                {o.runOptimizationMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Start Optimization
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
