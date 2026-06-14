import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Plus } from "lucide-react";
import { MANUAL_ENGINE_EVENT_TYPES, type EngineLogbookHookReturn } from "@/features/engine-logbook";
import { PermissionGate } from "@/components/PermissionGate";

export function AddEventDialog({ e }: { e: EngineLogbookHookReturn }) {
  return (
    <Dialog open={e.newEventDialogOpen} onOpenChange={e.setNewEventDialogOpen}>
      <PermissionGate resource="engine_logbook" action="create">
        <DialogTrigger asChild>
          <Button size="sm" disabled={e.isLocked} data-testid="button-add-event">
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </DialogTrigger>
      </PermissionGate>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Engine Room Event</DialogTitle>
          <DialogDescription>Record a manual event in the engine room log</DialogDescription>
        </DialogHeader>
        <Form {...e.eventForm}>
          <form onSubmit={e.eventForm.handleSubmit(e.onSubmitEvent)} className="space-y-4">
            <FormField
              control={e.eventForm.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-event-type">
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MANUAL_ENGINE_EVENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={e.eventForm.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Summary</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Brief description"
                      data-testid="input-event-summary"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={e.eventForm.control}
              name="details"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Additional details..." rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={e.eventForm.control}
                name="meRpm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ME RPM</FormLabel>
                    <FormControl>
                      <Input {...field} type="text" placeholder="RPM" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={e.eventForm.control}
                name="meLoad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ME Load %</FormLabel>
                    <FormControl>
                      <Input {...field} type="text" placeholder="Load %" />
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
                onClick={() => e.setNewEventDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={e.createEventMutation.isPending}
                data-testid="button-submit-event"
              >
                {e.createEventMutation.isPending ? "Creating..." : "Create Event"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
