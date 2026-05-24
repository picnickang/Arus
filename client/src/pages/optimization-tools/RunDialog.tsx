import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type OptimizationData = ReturnType<typeof import("@/features/maintenance").useOptimizationData>;

export function RunDialog({ o }: { o: OptimizationData }) {
  return (
    <Dialog open={o.runDialogOpen} onOpenChange={o.setRunDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run Optimization</DialogTitle>
          <DialogDescription>
            Execute optimization with selected configuration
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Configuration</Label>
            <p className="text-sm text-muted-foreground">
              {o.configurations?.find((c) => c.id === o.selectedConfiguration)?.name}
            </p>
          </div>
          <div>
            <Label htmlFor="time-horizon">Time Horizon (Days)</Label>
            <Input
              id="time-horizon"
              type="number"
              defaultValue={90}
              min={1}
              max={365}
              data-testid="input-run-time-horizon"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => o.setRunDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              o.selectedConfiguration &&
              o.runOptimizationMutation.mutate({ configId: o.selectedConfiguration })
            }
            disabled={o.runOptimizationMutation.isPending}
            data-testid="button-start-optimization"
          >
            {o.runOptimizationMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Start Optimization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
