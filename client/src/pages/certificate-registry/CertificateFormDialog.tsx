import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";
import { CERTIFICATE_TYPES, CERTIFICATE_STATUSES, ISSUING_AUTHORITY_TYPES } from "@shared/schema";
import type { VesselCertificate } from "@shared/schema";
import {
  CERT_TYPE_LABELS,
  CERT_STATUS_LABELS,
  AUTHORITY_TYPE_LABELS,
} from "./constants";
import { type CertFormData, defaultFormData } from "./types";

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
  const [form, setForm] = useState<CertFormData>(defaultFormData);
  const [editStatus, setEditStatus] = useState("");
  const [editNextSurveyDue, setEditNextSurveyDue] = useState("");

  const resetForm = (data?: VesselCertificate | null) => {
    if (data) {
      setForm({
        vesselId: data.vesselId || "",
        certificateType: data.certificateType || "",
        certificateName: data.certificateName || "",
        certificateNumber: data.certificateNumber || "",
        issuingAuthority: data.issuingAuthority || "",
        issuingAuthorityType: (data as any).issuingAuthorityType || "",
        issueDate: data.issueDate
          ? format(
              typeof data.issueDate === "string" ? parseISO(data.issueDate) : data.issueDate,
              "yyyy-MM-dd"
            )
          : "",
        expiryDate: data.expiryDate
          ? format(
              typeof data.expiryDate === "string" ? parseISO(data.expiryDate) : data.expiryDate,
              "yyyy-MM-dd"
            )
          : "",
        equipmentId: data.equipmentId || "",
        notes: data.notes || "",
      });
      setEditStatus(data.status || "valid");
      setEditNextSurveyDue(
        data.nextSurveyDue
          ? format(
              typeof data.nextSurveyDue === "string"
                ? parseISO(data.nextSurveyDue)
                : data.nextSurveyDue,
              "yyyy-MM-dd"
            )
          : ""
      );
    } else {
      setForm(defaultFormData);
      setEditStatus("");
      setEditNextSurveyDue("");
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      resetForm(mode === "edit" ? initialData : null);
    }
    onOpenChange(isOpen);
  };

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

  const handleSubmit = () => {
    if (mode === "create") {
      const payload: Record<string, unknown> = {
        vesselId: form.vesselId,
        certificateType: form.certificateType,
        certificateName: form.certificateName,
        issuingAuthority: form.issuingAuthority,
        issueDate: form.issueDate,
      };
      if (form.certificateNumber) {
        payload.certificateNumber = form.certificateNumber;
      }
      if (form.issuingAuthorityType) {
        payload.issuingAuthorityType = form.issuingAuthorityType;
      }
      if (form.expiryDate) {
        payload.expiryDate = form.expiryDate;
      }
      if (form.equipmentId) {
        payload.equipmentId = form.equipmentId;
      }
      if (form.notes) {
        payload.notes = form.notes;
      }
      createMutation.mutate(payload);
    } else {
      const payload: Record<string, unknown> = {};
      if (editStatus) {
        payload.status = editStatus;
      }
      if (form.certificateNumber) {
        payload.certificateNumber = form.certificateNumber;
      }
      if (form.expiryDate) {
        payload.expiryDate = form.expiryDate;
      }
      if (editNextSurveyDue) {
        payload.nextSurveyDue = editNextSurveyDue;
      }
      if (form.notes !== undefined) {
        payload.notes = form.notes;
      }
      updateMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isValid =
    mode === "create"
      ? form.vesselId &&
        form.certificateType &&
        form.certificateName &&
        form.issuingAuthority &&
        form.issueDate
      : true;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
        <div className="space-y-4 py-2">
          {mode === "create" && (
            <>
              <div className="space-y-2">
                <Label>Vessel *</Label>
                <Select
                  value={form.vesselId}
                  onValueChange={(v) => setForm({ ...form, vesselId: v })}
                >
                  <SelectTrigger data-testid="select-form-vessel">
                    <SelectValue placeholder="Select vessel" />
                  </SelectTrigger>
                  <SelectContent>
                    {vessels.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Certificate Type *</Label>
                <Select
                  value={form.certificateType}
                  onValueChange={(v) => setForm({ ...form, certificateType: v })}
                >
                  <SelectTrigger data-testid="select-form-cert-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CERTIFICATE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {CERT_TYPE_LABELS[t] || t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Certificate Name *</Label>
                <Input
                  value={form.certificateName}
                  onChange={(e) => setForm({ ...form, certificateName: e.target.value })}
                  placeholder="e.g., Cargo Ship Safety Equipment Certificate"
                  data-testid="input-form-cert-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Issuing Authority *</Label>
                <Input
                  value={form.issuingAuthority}
                  onChange={(e) => setForm({ ...form, issuingAuthority: e.target.value })}
                  placeholder="e.g., Lloyd's Register"
                  data-testid="input-form-issuing-authority"
                />
              </div>
              <div className="space-y-2">
                <Label>Issuing Authority Type</Label>
                <Select
                  value={form.issuingAuthorityType}
                  onValueChange={(v) => setForm({ ...form, issuingAuthorityType: v })}
                >
                  <SelectTrigger data-testid="select-form-authority-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ISSUING_AUTHORITY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {AUTHORITY_TYPE_LABELS[t] || t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Issue Date *</Label>
                  <Input
                    type="date"
                    value={form.issueDate}
                    onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                    data-testid="input-form-issue-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <Input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                    data-testid="input-form-expiry-date"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Equipment (optional)</Label>
                <Select
                  value={form.equipmentId || "none"}
                  onValueChange={(v) => setForm({ ...form, equipmentId: v === "none" ? "" : v })}
                >
                  <SelectTrigger data-testid="select-form-equipment">
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {equipmentList.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Certificate Number</Label>
            <Input
              value={form.certificateNumber}
              onChange={(e) => setForm({ ...form, certificateNumber: e.target.value })}
              placeholder="Certificate number"
              data-testid="input-form-cert-number"
            />
          </div>
          {mode === "edit" && (
            <>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger data-testid="select-form-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {CERTIFICATE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CERT_STATUS_LABELS[s] || s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <Input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                    data-testid="input-form-expiry-date-edit"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Next Survey Due</Label>
                  <Input
                    type="date"
                    value={editNextSurveyDue}
                    onChange={(e) => setEditNextSurveyDue(e.target.value)}
                    data-testid="input-form-next-survey"
                  />
                </div>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={3}
              data-testid="input-form-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-form-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !isValid}
            data-testid="button-form-submit"
          >
            {isPending ? "Saving..." : mode === "create" ? "Create" : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
