import { useEffect, useRef, useState } from "react";
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
import { ChevronDown, ChevronRight, DollarSign, IdCard, ImagePlus, Phone, Ship, User } from "lucide-react";
import {
  MARITIME_RANKS,
  CREW_STATUSES,
  EMPLOYMENT_TYPES,
  capitalizeNames,
  formatRank,
  useUnifiedCrewData,
} from "@/features/crew";
import type { CrewFormData, VesselListItem } from "@/features/crew";

type UnifiedCrewData = ReturnType<typeof useUnifiedCrewData>;

type StepKey = "identify" | "profile" | "pay";

const STEPS: { key: StepKey; label: string; fields: (keyof CrewFormData)[] }[] = [
  { key: "identify", label: "Identify", fields: ["name", "rank", "crewCode", "status", "employmentType"] },
  {
    key: "profile",
    label: "Profile",
    fields: [
      "vesselId",
      "reportsToId",
      "rotationOnDays",
      "rotationOffDays",
      "email",
      "phone",
      "address",
      "emergencyContactName",
      "emergencyContactPhone",
      "startDate",
      "contractEndDate",
    ],
  },
  { key: "pay", label: "Pay", fields: ["hourlyRate", "maxHours7d", "minRestH", "contractPenalty"] },
];

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Optional profile photo during intake — held until the crew id exists. */
function CrewIntakePhotoPicker({ d }: { d: UnifiedCrewData }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const file = d.pendingPhotoFile;
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [d.pendingPhotoFile]);

  const handleSelect = (selected: File | null | undefined) => {
    setError(null);
    if (!selected) {
      return;
    }
    if (!PHOTO_ACCEPTED.includes(selected.type)) {
      setError("Please choose a JPG, PNG, WebP, or GIF image.");
      return;
    }
    if (selected.size > PHOTO_MAX_BYTES) {
      setError("Image is too large. Maximum size is 5 MB.");
      return;
    }
    d.setPendingPhotoFile(selected);
  };

  return (
    <div className="flex items-center gap-4 rounded-md border border-dashed p-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
        {preview ? (
          <img src={preview} alt="Selected profile" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Profile photo (optional)</p>
        <input
          ref={inputRef}
          type="file"
          accept={PHOTO_ACCEPTED.join(",")}
          className="hidden"
          data-testid="input-intake-photo"
          onChange={(e) => handleSelect(e.target.files?.[0])}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            data-testid="button-intake-choose-photo"
          >
            {d.pendingPhotoFile ? "Change" : "Choose"}
          </Button>
          {d.pendingPhotoFile && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => d.setPendingPhotoFile(null)}
              data-testid="button-intake-clear-photo"
            >
              Remove
            </Button>
          )}
        </div>
        {error && (
          <p className="text-xs text-destructive" data-testid="text-intake-photo-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export function CrewFormDialog({
  d,
  contactSectionOpen,
  setContactSectionOpen,
  initialStep = 0,
}: {
  d: UnifiedCrewData;
  contactSectionOpen: boolean;
  setContactSectionOpen: (v: boolean) => void;
  initialStep?: number;
}) {
  const open = d.isAddCrewDialogOpen || d.isEditCrewDialogOpen;
  const [step, setStep] = useState(0);

  // Reset to the requested step (Assign jumps straight to the Profile step where
  // vessel / reports-to / rotation live) and suggest a crew code when the dialog
  // opens for a brand-new crew member. Editing keeps the stored code.
  useEffect(() => {
    if (!open) {
      setStep(0);
      return;
    }
    setStep(initialStep);
    if (!d.editingCrew && !d.crewForm.getValues("crewCode")) {
      const next = String(d.crew.length + 1).padStart(4, "0");
      d.crewForm.setValue("crewCode", `CRW-${next}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, d.editingCrew, initialStep]);

  const reportsToOptions = d.crew.filter((c) => c.id !== d.editingCrew?.id);
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const handleNext = async () => {
    const valid = await d.crewForm.trigger(STEPS[step].fields);
    if (valid) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
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
        <div className="flex w-full gap-2">
          {isFirst ? (
            <Button type="button" variant="outline" onClick={d.closeCrewDialog} className="flex-1">
              Cancel
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
              className="flex-1"
              data-testid="button-crew-back"
            >
              Back
            </Button>
          )}
          {isLast ? (
            <Button
              type="submit"
              onClick={d.crewForm.handleSubmit(d.onSubmitCrew)}
              disabled={d.createCrewMutation.isPending || d.updateCrewMutation.isPending}
              className="flex-1"
              data-testid="button-save-crew"
            >
              {d.editingCrew ? "Update" : "Add"} Crew Member
            </Button>
          ) : (
            <Button type="button" onClick={handleNext} className="flex-1" data-testid="button-crew-next">
              Next
            </Button>
          )}
        </div>
      }
    >
      {/* Stepper indicator */}
      <div className="mb-4 flex items-center gap-2" data-testid="crew-form-stepper">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-white/[0.06] text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-xs ${i === step ? "font-medium" : "text-muted-foreground"}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="text-muted-foreground">·</span>}
          </div>
        ))}
      </div>

      <Form {...d.crewForm}>
        <form className="space-y-5">
          {/* STEP 1 — IDENTIFY */}
          {step === 0 && (
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <User className="h-4 w-4" />
                Identity
              </h4>
              {!d.editingCrew && <CrewIntakePhotoPicker d={d} />}
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  name="crewCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <IdCard className="h-3.5 w-3.5" /> Crew Code
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="CRW-0001"
                          data-testid="input-crew-code"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={d.crewForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value || "active"} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-crew-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CREW_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
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
                  name="employmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employment Type</FormLabel>
                      <Select
                        value={field.value || "_unset"}
                        onValueChange={(v) => field.onChange(v === "_unset" ? "" : v)}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-employment-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_unset">Not set</SelectItem>
                          {EMPLOYMENT_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          {/* STEP 2 — PROFILE & ASSIGNMENT */}
          {step === 1 && (
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <Ship className="h-4 w-4" />
                Assignment
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={d.crewForm.control}
                  name="vesselId"
                  render={({ field }) => {
                    const activeVessels = d.vessels.filter((v) => v.active);
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
                                placeholder={d.vesselsLoading ? "Loading vessels..." : "Select vessel"}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="_unassigned">Unassigned</SelectItem>
                            {activeVessels.map((v: VesselListItem) => (
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
                <FormField
                  control={d.crewForm.control}
                  name="reportsToId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reports To (Optional)</FormLabel>
                      <Select
                        value={field.value || "_none"}
                        onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-reports-to">
                            <SelectValue placeholder="Select supervisor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">None</SelectItem>
                          {reportsToOptions.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} · {formatRank(c.rank)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={d.crewForm.control}
                  name="rotationOnDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rotation — Days On</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          placeholder="e.g. 28"
                          data-testid="input-rotation-on"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value ? Number.parseInt(e.target.value) : undefined)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={d.crewForm.control}
                  name="rotationOffDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rotation — Days Off</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          placeholder="e.g. 28"
                          data-testid="input-rotation-off"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value ? Number.parseInt(e.target.value) : undefined)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-4">
                <Collapsible open={contactSectionOpen} onOpenChange={setContactSectionOpen}>
                  <CollapsibleTrigger
                    className="flex w-full items-center justify-between"
                    data-testid="toggle-contact-section"
                  >
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
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
                          <p className="mt-1 text-xs text-muted-foreground">
                            Used for certification and document expiry alerts
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={d.crewForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="+65 9123 4567" data-testid="input-crew-phone" />
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
                              <Input {...field} placeholder="Home address" data-testid="input-crew-address" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="mt-2 border-t pt-3">
                      <h5 className="mb-3 text-xs font-medium text-muted-foreground">Emergency Contact</h5>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>
          )}

          {/* STEP 3 — PAY & HOURS */}
          {step === 2 && (
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <DollarSign className="h-4 w-4" />
                Pay & Hours
              </h4>
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
                          field.onChange(e.target.value ? Number.parseFloat(e.target.value) : undefined)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                          onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 72)}
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
                          onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 10)}
                        />
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
                          field.onChange(e.target.value ? Number.parseFloat(e.target.value) : undefined)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </form>
      </Form>
    </ResponsiveDialog>
  );
}
