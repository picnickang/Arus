import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CERTIFICATE_TYPES, CERTIFICATE_STATUSES, ISSUING_AUTHORITY_TYPES } from "@shared/schema";
import type { VesselCertificate } from "@shared/schema";
import { CERT_TYPE_LABELS, CERT_STATUS_LABELS, AUTHORITY_TYPE_LABELS } from "./constants";
import { toCreatePayload, toEditPatch, type CertificateFormData } from "./certificateFormSchema";
import { useCertificateForm } from "./useCertificateForm";

export function CertificateFormDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  vessels,
  equipmentList,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: VesselCertificate | null;
  vessels: Array<{ id: string; name: string }>;
  equipmentList: Array<{ id: string; name: string }>;
}) {
  const { toast } = useToast();
  const form = useCertificateForm({ open, mode, initialData });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/certificates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/summary"] });
      toast({
        title: "Certificate Created",
        description: "The certificate has been created successfully.",
      });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("PATCH", `/api/certificates/${initialData?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/summary"] });
      toast({
        title: "Certificate Updated",
        description: "The certificate has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: CertificateFormData) => {
    if (mode === "create") {
      createMutation.mutate(toCreatePayload(data));
    } else {
      updateMutation.mutate(toEditPatch(data));
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {mode === "create" ? "Add Certificate" : "Edit Certificate"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new vessel certificate to the registry."
              : "Update certificate details."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-4 py-2">
              {mode === "create" && (
                <>
                  <FormField
                    control={form.control}
                    name="vesselId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>Vessel</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-form-vessel">
                              <SelectValue placeholder="Select vessel" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {vessels.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.name}
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
                    name="certificateType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>Certificate Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-form-cert-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CERTIFICATE_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {CERT_TYPE_LABELS[t] || t}
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
                    name="certificateName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>Certificate Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., Cargo Ship Safety Equipment Certificate"
                            data-testid="input-form-cert-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="issuingAuthority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>Issuing Authority</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., Lloyd's Register"
                            data-testid="input-form-issuing-authority"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="issuingAuthorityType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Issuing Authority Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-form-authority-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ISSUING_AUTHORITY_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {AUTHORITY_TYPE_LABELS[t] || t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="issueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel required>Issue Date</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" data-testid="input-form-issue-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="expiryDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expiry Date</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" data-testid="input-form-expiry-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="equipmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipment (optional)</FormLabel>
                        <Select
                          value={field.value || "none"}
                          onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-form-equipment">
                              <SelectValue placeholder="Select equipment" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {equipmentList.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              <FormField
                control={form.control}
                name="certificateNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Certificate Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Certificate number"
                        data-testid="input-form-cert-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {mode === "edit" && (
                <>
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-form-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CERTIFICATE_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {CERT_STATUS_LABELS[s] || s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="expiryDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expiry Date</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="date"
                              data-testid="input-form-expiry-date-edit"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="nextSurveyDue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Next Survey Due</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" data-testid="input-form-next-survey" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Additional notes..."
                        rows={3}
                        data-testid="input-form-notes"
                      />
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
                onClick={() => onOpenChange(false)}
                data-testid="button-form-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-form-submit">
                {isPending ? "Saving..." : mode === "create" ? "Create" : "Update"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
