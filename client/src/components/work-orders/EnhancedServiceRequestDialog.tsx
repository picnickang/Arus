import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Wrench, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { useServiceProviders } from "@/features/suppliers/hooks/useSuppliers";
import { useEquipmentList } from "@/features/vessels/hooks/useVessels";
import { useDiscardGuard, DiscardConfirmDialog } from "@/hooks/useDiscardGuard";
import {
  useEnhancedServiceRequestForm,
  toEnhancedServiceRequestData,
  type EnhancedSrValues,
  type EnhancedServiceRequestData,
  type InitialServiceOrderData,
} from "@/features/work-orders/hooks/useEnhancedServiceRequestForm";
import { EquipmentMultiSelect, DatePickerField } from "./RequestDialogHelpers";
import { EnhancedServiceRequestAdvanced } from "./EnhancedServiceRequestAdvanced";

export type { EnhancedServiceRequestData, InitialServiceOrderData };

interface EnhancedServiceRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: EnhancedServiceRequestData) => void;
  isPending: boolean;
  initialData?: InitialServiceOrderData;
  isEditing?: boolean;
  defaultExpanded?: boolean;
}

let sessionAdvancedState: boolean | null = null;

export function EnhancedServiceRequestDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  initialData,
  isEditing = false,
  defaultExpanded = false,
}: EnhancedServiceRequestDialogProps) {
  const { data: providers = [] } = useServiceProviders();
  const { data: equipment = [] } = useEquipmentList();

  const { form, certArray, addCertificate } = useEnhancedServiceRequestForm(
    open,
    isEditing,
    initialData
  );

  const [showAdvanced, setShowAdvanced] = useState(() => {
    if (defaultExpanded || isEditing) {
      return true;
    }
    return sessionAdvancedState ?? false;
  });

  const advancedSectionRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      if (defaultExpanded || isEditing) {
        setShowAdvanced(true);
      } else {
        setShowAdvanced(sessionAdvancedState ?? false);
      }
    }
  }, [open, defaultExpanded, isEditing]);

  const showCertificates = form.watch("assistanceTags").includes("certificate_renewal");

  const guard = useDiscardGuard({ isDirty: form.formState.isDirty, onOpenChange });

  function submit(values: EnhancedSrValues) {
    onSubmit(toEnhancedServiceRequestData(values, { showAdvanced, showCertificates }));
  }

  const handleAdvancedOpenChange = (newState: boolean) => {
    setShowAdvanced(newState);
    sessionAdvancedState = newState;
    if (newState) {
      setTimeout(() => {
        advancedSectionRef.current
          ?.querySelector<HTMLElement>("input, textarea, select, button")
          ?.focus();
      }, 150);
    } else {
      setTimeout(() => toggleRef.current?.focus(), 50);
    }
  };

  return (
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] md:w-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {isEditing ? "Edit Service Order" : "Quick Service Request"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the service order details."
              : "Fill in the basics, or expand advanced options for full details."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="providerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required={!isEditing}>Service Provider</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-service-provider">
                          <SelectValue placeholder="Select provider..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {providers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="requestedStartDate"
                render={({ field }) => (
                  <FormItem>
                    <DatePickerField
                      label={isEditing ? "Requested Date" : "Requested Date *"}
                      value={field.value}
                      onChange={field.onChange}
                      testId="date-start"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="equipmentIds"
              render={({ field }) => (
                <FormItem>
                  <EquipmentMultiSelect
                    equipment={equipment}
                    selectedIds={field.value}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="symptomDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the work needed..."
                      rows={3}
                      data-testid="input-symptom"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Collapsible open={showAdvanced} onOpenChange={handleAdvancedOpenChange}>
              <CollapsibleTrigger asChild>
                <button
                  ref={toggleRef}
                  type="button"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full py-2"
                  data-testid="toggle-advanced-options"
                >
                  <Settings2 className="h-4 w-4" />
                  {showAdvanced ? "Hide advanced options" : "Show advanced options"}
                  {showAdvanced ? (
                    <ChevronUp className="h-4 w-4 ml-auto" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-auto" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2">
                <EnhancedServiceRequestAdvanced
                  form={form}
                  certArray={certArray}
                  addCertificate={addCertificate}
                  showCertificates={showCertificates}
                  sectionRef={advancedSectionRef}
                />
              </CollapsibleContent>
            </Collapsible>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guard.handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-submit-service-request"
              >
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Update Service Order" : "Create Service Order"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
      <DiscardConfirmDialog
        open={guard.confirmOpen}
        onConfirm={guard.onConfirm}
        onCancel={guard.onCancel}
      />
    </Dialog>
  );
}

export default EnhancedServiceRequestDialog;
