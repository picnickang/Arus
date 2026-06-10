import type { RefObject } from "react";
import type { UseFormReturn, UseFieldArrayReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, AlertTriangle, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnhancedSrValues } from "@/features/work-orders/hooks/useEnhancedServiceRequestForm";
import { DatePickerField } from "./RequestDialogHelpers";

const SEVERITY_OPTIONS = [
  { value: "general", label: "General", color: "bg-blue-100 text-blue-800" },
  { value: "safety", label: "Safety", color: "bg-amber-100 text-amber-800" },
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-800" },
];

const ASSISTANCE_TAGS = [
  { value: "servicing", label: "Servicing" },
  { value: "calibration", label: "Calibration" },
  { value: "pressure_test", label: "Pressure Test" },
  { value: "replacement", label: "Replacement" },
  { value: "certificate_renewal", label: "Certificate Renewal" },
  { value: "repair", label: "Repair" },
];

interface AdvancedSectionProps {
  form: UseFormReturn<EnhancedSrValues, unknown, EnhancedSrValues>;
  certArray: UseFieldArrayReturn<EnhancedSrValues, "certificateItems">;
  addCertificate: () => void;
  showCertificates: boolean;
  sectionRef: RefObject<HTMLDivElement>;
}

export function EnhancedServiceRequestAdvanced({
  form,
  certArray,
  addCertificate,
  showCertificates,
  sectionRef,
}: AdvancedSectionProps) {
  const severity = form.watch("severity");
  const assistanceTags = form.watch("assistanceTags");
  const mocRequired = form.watch("mocRequired");

  const toggleTag = (tag: string) => {
    form.setValue(
      "assistanceTags",
      assistanceTags.includes(tag)
        ? assistanceTags.filter((t) => t !== tag)
        : [...assistanceTags, tag],
      { shouldDirty: true }
    );
  };

  return (
    <div ref={sectionRef} className="space-y-6 pt-4">
      <Separator />

      <div>
        <Label>Severity</Label>
        <div className="flex gap-2 mt-2">
          {SEVERITY_OPTIONS.map((opt) => (
            <Badge
              key={opt.value}
              className={cn(
                "cursor-pointer px-3 py-1",
                severity === opt.value
                  ? opt.color
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              onClick={() => form.setValue("severity", opt.value, { shouldDirty: true })}
              data-testid={`badge-severity-${opt.value}`}
            >
              {opt.label}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Assistance Required</Label>
        <div className="flex flex-wrap gap-2">
          {ASSISTANCE_TAGS.map((tag) => (
            <Badge
              key={tag.value}
              variant={assistanceTags.includes(tag.value) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleTag(tag.value)}
              data-testid={`tag-${tag.value}`}
            >
              {tag.label}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Diagnostics
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="probableCause"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Probable Cause</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What might be causing this..."
                    rows={2}
                    data-testid="input-probable-cause"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="actionTakenSoFar"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Action Taken So Far</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Any troubleshooting done..."
                    rows={2}
                    data-testid="input-action-taken"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="isRecurringDefect"
          render={({ field }) => (
            <FormItem className="flex items-center space-x-2 space-y-0">
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-recurring"
                />
              </FormControl>
              <FormLabel className="font-normal">Recurring Defect</FormLabel>
            </FormItem>
          )}
        />
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <CalendarIcon className="h-4 w-4" />
          Scheduling
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="requestedEndDate"
            render={({ field }) => (
              <FormItem>
                <DatePickerField
                  label="Requested End Date"
                  value={field.value}
                  onChange={field.onChange}
                  testId="date-end"
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="estimatedHours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estimated Hours</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" data-testid="input-hours" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="quotedAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quoted Amount ($)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0.00" data-testid="input-quote" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Separator />

      <div className="space-y-4">
        <FormField
          control={form.control}
          name="mocRequired"
          render={({ field }) => (
            <FormItem className="flex items-center space-x-2 space-y-0">
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-moc"
                />
              </FormControl>
              <FormLabel className="font-normal">MOC (Management of Change) Required</FormLabel>
            </FormItem>
          )}
        />
        {mocRequired && (
          <FormField
            control={form.control}
            name="mocNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>MOC Number</FormLabel>
                <FormControl>
                  <Input placeholder="MOC-2024-001" data-testid="input-moc-number" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        )}
      </div>

      {showCertificates && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Certificate Renewals</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCertificate}
                data-testid="btn-add-certificate"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Certificate
              </Button>
            </div>
            {certArray.fields.map((row, index) => {
              const certId = form.watch(`certificateItems.${index}.certId`);
              return (
                <div key={row.id} className="grid grid-cols-4 gap-2 items-end">
                  <FormField
                    control={form.control}
                    name={`certificateItems.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Certificate Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Certificate name"
                            data-testid={`input-cert-name-${certId}`}
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`certificateItems.${index}.expiryDate`}
                    render={({ field }) => (
                      <FormItem>
                        <DatePickerField
                          label="Expiry Date"
                          value={field.value}
                          onChange={field.onChange}
                          testId={`cert-expiry-${certId}`}
                          compact
                        />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`certificateItems.${index}.remarks`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Remarks</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Remarks"
                            data-testid={`input-cert-remarks-${certId}`}
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => certArray.remove(index)}
                    data-testid={`btn-remove-cert-${certId}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Additional Notes</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Any additional notes..."
                rows={2}
                data-testid="input-notes"
                {...field}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
