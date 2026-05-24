import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Loader2, Plus } from "lucide-react";

type OptimizationData = ReturnType<typeof import("@/features/maintenance").useOptimizationData>;

export function ConfigDialog({ o }: { o: OptimizationData }) {
  return (
    <Dialog open={o.configDialogOpen} onOpenChange={o.setConfigDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-create-config">
          <Plus className="h-4 w-4 mr-2" />
          New Configuration
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Optimizer Configuration</DialogTitle>
          <DialogDescription>
            Configure a new optimization scenario with algorithm parameters and constraints
          </DialogDescription>
        </DialogHeader>
        <Form {...o.configForm}>
          <form onSubmit={o.configForm.handleSubmit(o.onSubmitConfig)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={o.configForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Configuration Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Fleet Maintenance Optimization"
                        {...field}
                        data-testid="input-config-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={o.configForm.control}
                name="algorithmType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Algorithm Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-algorithm-type">
                          <SelectValue placeholder="Select algorithm" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="greedy">Greedy (Fast)</SelectItem>
                        <SelectItem value="genetic">Genetic Algorithm</SelectItem>
                        <SelectItem value="simulated_annealing">Simulated Annealing</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={o.configForm.control}
                name="maxSchedulingHorizon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Horizon (Days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number.parseInt(e.target.value))}
                        data-testid="input-time-horizon"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={o.configForm.control}
                name="costWeightFactor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Weight Factor</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        {...field}
                        onChange={(e) => field.onChange(Number.parseFloat(e.target.value))}
                        data-testid="input-cost-weight"
                      />
                    </FormControl>
                    <FormDescription>Weight for cost optimization (0 - 1)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={o.configForm.control}
                name="urgencyWeightFactor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Urgency Weight Factor</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        {...field}
                        onChange={(e) => field.onChange(Number.parseFloat(e.target.value))}
                        data-testid="input-urgency-weight"
                      />
                    </FormControl>
                    <FormDescription>Weight for urgency optimization (0 - 1)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={o.configForm.control}
                name="conflictResolutionStrategy"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Conflict Resolution Strategy</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-conflict-strategy">
                          <SelectValue placeholder="Select strategy" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="priority_based">Priority Based</SelectItem>
                        <SelectItem value="cost_based">Cost Based</SelectItem>
                        <SelectItem value="earliest_first">Earliest First</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={o.configForm.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>Enabled</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-enabled"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={o.configForm.control}
                name="resourceConstraintStrict"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>Strict Resource Constraints</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-strict-constraints"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => o.setConfigDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={o.createConfigMutation.isPending}
                data-testid="button-save-config"
              >
                {o.createConfigMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save Configuration
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
