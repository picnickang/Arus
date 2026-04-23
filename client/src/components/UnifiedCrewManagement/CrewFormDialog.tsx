import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { ChevronDown, ChevronRight, DollarSign, FileText, Phone, User } from "lucide-react";
import { MARITIME_RANKS, capitalizeNames } from "@/features/crew";

export function CrewFormDialog({
  d,
  contactSectionOpen,
  setContactSectionOpen,
}: {
  d: any;
  contactSectionOpen: boolean;
  setContactSectionOpen: (v: boolean) => void;
}) {
  return (
    <ResponsiveDialog
      open={d.isAddCrewDialogOpen || d.isEditCrewDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          setContactSectionOpen(false);
          d.closeCrewDialog();
        }
      }}
      title={d.editingCrew ? "Edit Crew Member" : "Add New Crew Member"}
      description={
        d.editingCrew
          ? "Update crew member information"
          : "Register a new crew member with maritime qualifications"
      }
      footer={
        <div className="flex gap-2 w-full">
          <Button type="button" variant="outline" onClick={d.closeCrewDialog} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={d.crewForm.handleSubmit(d.onSubmitCrew)}
            disabled={d.createCrewMutation.isPending || d.updateCrewMutation.isPending}
            className="flex-1"
            data-testid="button-save-crew"
          >
            {d.editingCrew ? "Update" : "Add"} Crew Member
          </Button>
        </div>
      }
    >
      <Form {...d.crewForm}>
        <form className="space-y-5">
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Personal Information
            </h4>
            <div className="space-y-4">
              <FormField
                control={d.crewForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Full name"
                        onChange={(e) => field.onChange(capitalizeNames(e.target.value))}
                        data-testid="input-crew-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={d.crewForm.control}
                  name="rank"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rank</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-crew-rank">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MARITIME_RANKS.map((rank) => (
                            <SelectItem key={rank} value={rank}>
                              {rank}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={d.crewForm.control}
                  name="vesselId"
                  render={({ field }) => {
                    const activeVessels = d.vessels.filter((v: any) => v.active);
                    return (
                      <FormItem>
                        <FormLabel>Vessel (Optional)</FormLabel>
                        <Select
                          value={field.value || "_unassigned"}
                          onValueChange={(v) => field.onChange(v === "_unassigned" ? "" : v)}
                          disabled={d.vesselsLoading}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-crew-vessel">
                              <SelectValue
                                placeholder={
                                  d.vesselsLoading ? "Loading vessels..." : "Select vessel"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="_unassigned">Unassigned</SelectItem>
                            {activeVessels.map((v: any) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Assignment & Pay
            </h4>
            <div className="space-y-4">
              <FormField
                control={d.crewForm.control}
                name="hourlyRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hourly Salary (SGD)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 45.00"
                        data-testid="input-hourly-rate"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? Number.parseFloat(e.target.value) : undefined
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={d.crewForm.control}
                  name="maxHours7d"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Hours/Week</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          data-testid="input-max-hours"
                          onChange={(e) =>
                            field.onChange(Number.parseInt(e.target.value) || 72)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={d.crewForm.control}
                  name="minRestH"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Rest Hours</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          data-testid="input-min-rest"
                          onChange={(e) =>
                            field.onChange(Number.parseInt(e.target.value) || 10)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <Collapsible open={contactSectionOpen} onOpenChange={setContactSectionOpen}>
              <CollapsibleTrigger
                className="w-full flex items-center justify-between"
                data-testid="toggle-contact-section"
              >
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Contact & Emergency
                </h4>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{contactSectionOpen ? "Hide" : "Show"}</span>
                  {contactSectionOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-4">
                <FormField
                  control={d.crewForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (for alert notifications)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="email@example.com"
                          data-testid="input-crew-email"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        Used for certification and document expiry alerts
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={d.crewForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="+65 9123 4567"
                            data-testid="input-crew-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={d.crewForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Home address"
                            data-testid="input-crew-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="border-t pt-3 mt-2">
                  <h5 className="text-xs font-medium text-muted-foreground mb-3">
                    Emergency Contact
                  </h5>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={d.crewForm.control}
                      name="emergencyContactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Emergency contact name"
                              data-testid="input-emergency-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={d.crewForm.control}
                      name="emergencyContactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="+65 9123 4567"
                              data-testid="input-emergency-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Contract Dates
            </h4>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={d.crewForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Start Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={d.crewForm.control}
                  name="contractEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract End Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-contract-end-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={d.crewForm.control}
                name="contractPenalty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Cancellation Penalty (SGD)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 5000.00"
                        data-testid="input-contract-penalty"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? Number.parseFloat(e.target.value) : undefined
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </form>
      </Form>
    </ResponsiveDialog>
  );
}
