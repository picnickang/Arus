import { AlertTriangle, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionGate } from "@/components/PermissionGate";
import { formatVesselClass, vesselClasses, vesselConditions } from "./utils";
import type { VesselManagementModel } from "./VesselManagementTypes";

export function VesselManagementActions({ model: v }: { model: VesselManagementModel }) {
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <PermissionGate resource="vessels" action="create">
          <Button
            variant="outline"
            className="gap-2"
            onClick={v.handleImport}
            disabled={v.importVesselMutation.isPending}
            data-testid="button-import-vessel"
          >
            <Upload className="h-4 w-4" />
            Import Vessel
          </Button>
        </PermissionGate>
        <PermissionGate resource="vessels" action="create">
          <Dialog open={v.isCreateDialogOpen} onOpenChange={v.setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-vessel">
                <Plus className="h-4 w-4" />
                Add Vessel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto max-md:left-0 max-md:top-auto max-md:bottom-0 max-md:translate-x-0 max-md:translate-y-0 max-md:w-full max-md:max-w-full max-md:rounded-t-xl max-md:rounded-b-none max-md:max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Add New Vessel</DialogTitle>
                <DialogDescription>Create a new vessel record for your fleet</DialogDescription>
              </DialogHeader>
              <Form {...v.form}>
                <form onSubmit={v.form.handleSubmit(v.handleCreate)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={v.form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vessel Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="MV Atlantic Explorer"
                              {...field}
                              data-testid="input-vessel-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={v.form.control}
                      name="vesselClass"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vessel Class</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value ?? undefined}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-vessel-class">
                                <SelectValue placeholder="Select class" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {vesselClasses.map((cls) => (
                                <SelectItem key={cls} value={cls}>
                                  {formatVesselClass(cls)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={v.form.control}
                      name="condition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Condition</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-vessel-condition">
                                <SelectValue placeholder="Select condition" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {vesselConditions.map((condition) => (
                                <SelectItem key={condition} value={condition}>
                                  {condition.charAt(0).toUpperCase() + condition.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={v.form.control}
                      name="dayRateSgd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Day Rate (SGD)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="10000.00"
                              {...field}
                              value={field.value ?? ""}
                              data-testid="input-day-rate"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => v.setIsCreateDialogOpen(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={v.createVesselMutation.isPending}
                      data-testid="button-create-vessel"
                    >
                      {v.createVesselMutation.isPending ? "Creating..." : "Create Vessel"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>
    </div>
  );
}

export function VesselManagementDialogs({ model: v }: { model: VesselManagementModel }) {
  return (
    <>
      <Dialog open={v.isEditDialogOpen} onOpenChange={v.setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto max-md:left-0 max-md:top-auto max-md:bottom-0 max-md:translate-x-0 max-md:translate-y-0 max-md:w-full max-md:max-w-full max-md:rounded-t-xl max-md:rounded-b-none max-md:max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Vessel</DialogTitle>
            <DialogDescription>Update vessel information</DialogDescription>
          </DialogHeader>
          <Form {...v.editForm}>
            <form onSubmit={v.editForm.handleSubmit(v.handleUpdate)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={v.editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vessel Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="MV Atlantic Explorer"
                          {...field}
                          data-testid="input-edit-vessel-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={v.editForm.control}
                  name="vesselClass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vessel Class</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-vessel-class">
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vesselClasses.map((cls) => (
                            <SelectItem key={cls} value={cls}>
                              {formatVesselClass(cls)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={v.editForm.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-vessel-condition">
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vesselConditions.map((condition) => (
                            <SelectItem key={condition} value={condition}>
                              {condition.charAt(0).toUpperCase() + condition.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={v.editForm.control}
                  name="dayRateSgd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Day Rate (SGD)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="10000.00"
                          {...field}
                          value={field.value ?? ""}
                          data-testid="input-edit-day-rate"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {v.selectedVessel &&
                ((selectedVesselId: string) => (
                  <div className="pt-4 border-t" data-vessel-id={selectedVesselId}>
                    <h3 className="text-lg font-medium mb-3 text-destructive">Danger Zone</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/50">
                        <div>
                          <div className="font-medium">Reset Downtime Counter</div>
                          <div className="text-sm text-muted-foreground">
                            Reset accumulated downtime hours to zero
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => v.resetDowntimeMutation.mutate(selectedVesselId)}
                          disabled={v.resetDowntimeMutation.isPending}
                          data-testid="button-reset-downtime"
                        >
                          {v.resetDowntimeMutation.isPending ? "Resetting..." : "Reset Downtime"}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/50">
                        <div>
                          <div className="font-medium">Reset Operation Counter</div>
                          <div className="text-sm text-muted-foreground">
                            Reset accumulated operation hours to zero
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => v.resetOperationMutation.mutate(selectedVesselId)}
                          disabled={v.resetOperationMutation.isPending}
                          data-testid="button-reset-operation"
                        >
                          {v.resetOperationMutation.isPending ? "Resetting..." : "Reset Operation"}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border-2 border-destructive">
                        <div>
                          <div className="font-medium text-destructive">Wipe All Vessel Data</div>
                          <div className="text-sm text-muted-foreground">
                            Delete all telemetry, DTCs, and insights for this vessel
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={v.handleWipeVesselData}
                          disabled={v.wipeVesselDataMutation.isPending}
                          data-testid="button-wipe-vessel-data"
                        >
                          {v.wipeVesselDataMutation.isPending
                            ? "Wiping..."
                            : "Wipe All Vessel Data"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))(v.selectedVessel.id)}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => v.setIsEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={v.updateVesselMutation.isPending}
                  data-testid="button-update-vessel"
                >
                  {v.updateVesselMutation.isPending ? "Updating..." : "Update Vessel"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={v.isDeleteDialogOpen} onOpenChange={v.setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Vessel
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{v.selectedVessel?.name}"?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium mb-2">What will be deleted:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Vessel record and configuration</li>
                <li>All associated equipment and sensors</li>
                <li>All telemetry, work orders, and maintenance data</li>
                <li>Port calls, drydock windows, and schedules</li>
              </ul>
            </div>
            <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-3">
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                Info: Crew will be unassigned
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Crew members will not be deleted. They will be unassigned from this vessel and
                available for reassignment.
              </p>
            </div>
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive font-medium">
                Warning: This action cannot be undone
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                All equipment and related data will be permanently deleted.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                v.setIsDeleteDialogOpen(false);
                v.setSelectedVessel(null);
              }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={v.confirmDelete}
              disabled={v.deleteVesselMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {v.deleteVesselMutation.isPending ? "Deleting..." : "Delete Vessel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
