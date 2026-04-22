import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { CERTIFICATE_TYPES, CERTIFICATE_STATUSES, ISSUING_AUTHORITY_TYPES } from "@shared/schema";
import type { VesselCertificate } from "@shared/schema";
import {
  FileText,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Ship,
  AlertTriangle,
} from "lucide-react";

export const CERT_TYPE_LABELS: Record<string, string> = {
  safety_equipment: "Safety Equipment",
  safety_radio: "Safety Radio",
  safety_construction: "Safety Construction",
  load_line: "Load Line",
  iopp: "IOPP (Oil Pollution Prevention)",
  ispp: "ISPP (Sewage Pollution Prevention)",
  class_machinery: "Class Machinery",
  class_hull: "Class Hull",
  class_electrical: "Class Electrical",
  smc: "SMC (Safety Management)",
  issc: "ISSC (Ship Security)",
  doc: "DOC (Document of Compliance)",
  mlc: "MLC (Maritime Labour)",
  ism: "ISM (Safety Management Code)",
  tonnage: "Tonnage",
  registry: "Registry",
  minimum_safe_manning: "Minimum Safe Manning",
  other: "Other",
};

const CERT_STATUS_LABELS: Record<string, string> = {
  valid: "Current",
  expired: "Expired",
  suspended: "Suspended",
  withdrawn: "Withdrawn",
  pending_renewal: "Pending Renewal",
};

const AUTHORITY_TYPE_LABELS: Record<string, string> = {
  class_society: "Class Society",
  flag_state: "Flag State",
  recognized_organization: "Recognized Organization",
  port_state: "Port State",
};

export function getCertExpiryStatus(expiryDate: string | Date | null | undefined): {
  level: string;
  label: string;
  badgeClass: string;
} | null {
  if (!expiryDate) {
    return null;
  }
  const expiry = typeof expiryDate === "string" ? parseISO(expiryDate) : expiryDate;
  const now = new Date();
  const days = differenceInDays(expiry, now);

  if (days < 0) {
    return {
      level: "expired",
      label: "Expired",
      badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
  }
  if (days <= 30) {
    return {
      level: "critical",
      label: `${days} days`,
      badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
  }
  if (days <= 60) {
    return {
      level: "warning",
      label: `${days} days`,
      badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    };
  }
  if (days <= 90) {
    return {
      level: "notice",
      label: `${days} days`,
      badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    };
  }
  return {
    level: "current",
    label: "Current",
    badgeClass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  };
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "valid":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "expired":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "suspended":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    case "withdrawn":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    case "pending_renewal":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) {
    return "—";
  }
  try {
    const date = typeof d === "string" ? parseISO(d) : d;
    return format(date, "dd MMM yyyy");
  } catch {
    return "—";
  }
}

interface CertFormData {
  vesselId: string;
  certificateType: string;
  certificateName: string;
  certificateNumber: string;
  issuingAuthority: string;
  issuingAuthorityType: string;
  issueDate: string;
  expiryDate: string;
  equipmentId: string;
  notes: string;
}

const defaultFormData: CertFormData = {
  vesselId: "",
  certificateType: "",
  certificateName: "",
  certificateNumber: "",
  issuingAuthority: "",
  issuingAuthorityType: "",
  issueDate: "",
  expiryDate: "",
  equipmentId: "",
  notes: "",
};

function CertificateFormDialog({
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

const PAGE_SIZE = 15;

export default function CertificateRegistryPage() {
  const { toast } = useToast();
  const urlParams = new URLSearchParams(window.location.search);
  const initialEquipmentId = urlParams.get("equipmentId") || "all";
  const [searchQuery, setSearchQuery] = useState("");
  const [vesselFilter, setVesselFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [equipmentFilter, setEquipmentFilter] = useState(initialEquipmentId);
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState<VesselCertificate | null>(null);

  const queryParams: Record<string, string> = {};
  if (vesselFilter !== "all") {
    queryParams.vesselId = vesselFilter;
  }
  if (typeFilter !== "all") {
    queryParams.type = typeFilter;
  }
  if (statusFilter !== "all") {
    queryParams.status = statusFilter;
  }

  const { data: certificates = [], isLoading: isLoadingCerts } = useQuery<VesselCertificate[]>({
    queryKey: ["/api/certificates", queryParams],
  });

  const { data: rawSummary, isLoading: isLoadingSummary } = useQuery<{
    totalCertificates: number;
    valid: number;
    expired: number;
    suspended: number;
    pendingRenewal: number;
    expiringIn30Days: number;
    expiringIn90Days: number;
  }>({
    queryKey: ["/api/certificates/summary"],
  });

  const summary = rawSummary
    ? {
        total: rawSummary.totalCertificates,
        valid: rawSummary.valid,
        expiringSoon: rawSummary.expiringIn90Days,
        expired: rawSummary.expired,
        suspended: rawSummary.suspended,
        pendingRenewal: rawSummary.pendingRenewal,
      }
    : undefined;

  const { data: vessels = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/vessels"],
  });

  const { data: equipmentList = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/equipment"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/certificates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/summary"] });
      toast({ title: "Certificate Deleted", description: "The certificate has been removed." });
      setIsDeleteOpen(false);
      setSelectedCert(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const vesselMap = useMemo(() => {
    const map = new Map<string, string>();
    vessels.forEach((v) => map.set(v.id, v.name));
    return map;
  }, [vessels]);

  const equipmentMap = useMemo(() => {
    const map = new Map<string, string>();
    equipmentList.forEach((e) => map.set(e.id, e.name));
    return map;
  }, [equipmentList]);

  const filteredCerts = useMemo(() => {
    let result = certificates;
    if (equipmentFilter !== "all") {
      result = result.filter((c) => c.equipmentId === equipmentFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.certificateName?.toLowerCase().includes(q) ||
          c.certificateNumber?.toLowerCase().includes(q) ||
          c.issuingAuthority?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [certificates, searchQuery, equipmentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCerts.length / PAGE_SIZE));
  const paginatedCerts = filteredCerts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasActiveFilters =
    vesselFilter !== "all" ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    equipmentFilter !== "all" ||
    searchQuery.trim() !== "";

  const clearFilters = () => {
    setVesselFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setEquipmentFilter("all");
    setSearchQuery("");
    setPage(1);
  };

  const handleView = (cert: VesselCertificate) => {
    setSelectedCert(cert);
    setIsDetailOpen(true);
  };

  const handleEdit = (cert: VesselCertificate) => {
    setSelectedCert(cert);
    setIsEditOpen(true);
  };

  const handleDeleteClick = (cert: VesselCertificate) => {
    setSelectedCert(cert);
    setIsDeleteOpen(true);
  };

  const isLoading = isLoadingCerts || isLoadingSummary;

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Certificate Registry
          </h1>
          <Button onClick={() => setIsCreateOpen(true)} data-testid="button-add-certificate">
            <Plus className="h-4 w-4 mr-2" />
            Add Certificate
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between gap-1">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold" data-testid="text-summary-total">
                    {summary?.total ?? 0}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between gap-1">
                <div>
                  <p className="text-sm text-muted-foreground">Valid</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-summary-valid">
                    {summary?.valid ?? 0}
                  </p>
                </div>
                <ShieldCheck className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between gap-1">
                <div>
                  <p className="text-sm text-muted-foreground">Expiring Soon</p>
                  <p
                    className="text-2xl font-bold text-amber-600"
                    data-testid="text-summary-expiring"
                  >
                    {summary?.expiringSoon ?? 0}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between gap-1">
                <div>
                  <p className="text-sm text-muted-foreground">Expired</p>
                  <p className="text-2xl font-bold text-red-600" data-testid="text-summary-expired">
                    {summary?.expired ?? 0}
                  </p>
                </div>
                <ShieldAlert className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <div className="p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search certificates..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={vesselFilter}
                  onValueChange={(v) => {
                    setVesselFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-40" data-testid="select-vessel">
                    <SelectValue placeholder="Vessel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vessels</SelectItem>
                    {vessels.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={typeFilter}
                  onValueChange={(v) => {
                    setTypeFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-40" data-testid="select-type">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {CERTIFICATE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {CERT_TYPE_LABELS[t] || t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-40" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {CERTIFICATE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CERT_STATUS_LABELS[s] || s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={equipmentFilter}
                  onValueChange={(v) => {
                    setEquipmentFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-44" data-testid="select-equipment">
                    <SelectValue placeholder="Equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Equipment</SelectItem>
                    {equipmentList.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="p-0">
            <Table data-testid="table-certificates">
              <TableHeader>
                <TableRow>
                  <TableHead>Certificate Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Issuer</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {hasActiveFilters
                        ? "No certificates match your filters"
                        : "No certificates found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCerts.map((cert) => {
                    const expiryStatus = getCertExpiryStatus(cert.expiryDate);
                    return (
                      <TableRow
                        key={cert.id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => handleView(cert)}
                        data-testid={`row-certificate-${cert.id}`}
                      >
                        <TableCell>
                          <div className="font-medium">{cert.certificateName}</div>
                          {cert.certificateNumber && (
                            <div className="text-xs text-muted-foreground">
                              #{cert.certificateNumber}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {CERT_TYPE_LABELS[cert.certificateType] || cert.certificateType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Ship className="h-3.5 w-3.5 text-blue-600" />
                            <span className="text-sm">
                              {vesselMap.get(cert.vesselId) || cert.vesselId}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {cert.equipmentId ? (
                            <span className="text-sm">
                              {equipmentMap.get(cert.equipmentId) || cert.equipmentId}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeClass(cert.status)}>
                            {CERT_STATUS_LABELS[cert.status] || cert.status}
                          </Badge>
                          {expiryStatus &&
                            cert.status === "valid" &&
                            expiryStatus.level !== "current" && (
                              <Badge className={`ml-1 ${expiryStatus.badgeClass}`}>
                                {expiryStatus.label}
                              </Badge>
                            )}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(cert.expiryDate)}</TableCell>
                        <TableCell className="text-sm">{cert.issuingAuthority}</TableCell>
                        <TableCell className="text-right">
                          <div
                            className="flex items-center justify-end gap-1"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            role="presentation"
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(cert);
                              }}
                              data-testid={`button-edit-${cert.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(cert);
                              }}
                              data-testid={`button-delete-${cert.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, filteredCerts.length)} of {filteredCerts.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            {selectedCert && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {selectedCert.certificateName}
                  </SheetTitle>
                  <SheetDescription>
                    {CERT_TYPE_LABELS[selectedCert.certificateType] || selectedCert.certificateType}
                    {selectedCert.certificateNumber && ` — #${selectedCert.certificateNumber}`}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={getStatusBadgeClass(selectedCert.status)}>
                      {CERT_STATUS_LABELS[selectedCert.status] || selectedCert.status}
                    </Badge>
                    {(() => {
                      const es = getCertExpiryStatus(selectedCert.expiryDate);
                      return es && es.level !== "current" ? (
                        <Badge className={es.badgeClass}>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {es.label}
                        </Badge>
                      ) : null;
                    })()}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Vessel</p>
                      <p className="font-medium">
                        {vesselMap.get(selectedCert.vesselId) || selectedCert.vesselId}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Equipment</p>
                      <p className="font-medium">
                        {selectedCert.equipmentId
                          ? equipmentMap.get(selectedCert.equipmentId) || selectedCert.equipmentId
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Certificate Type</p>
                      <p className="font-medium">
                        {CERT_TYPE_LABELS[selectedCert.certificateType] ||
                          selectedCert.certificateType}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Certificate Number</p>
                      <p className="font-medium">{selectedCert.certificateNumber || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Issuing Authority</p>
                      <p className="font-medium">{selectedCert.issuingAuthority}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Authority Type</p>
                      <p className="font-medium">
                        {AUTHORITY_TYPE_LABELS[(selectedCert as any).issuingAuthorityType] ||
                          (selectedCert as any).issuingAuthorityType ||
                          "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Issue Date</p>
                      <p className="font-medium">{formatDate(selectedCert.issueDate)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Expiry Date</p>
                      <p className="font-medium">{formatDate(selectedCert.expiryDate)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Last Survey</p>
                      <p className="font-medium">{formatDate(selectedCert.lastSurveyDate)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Next Survey Due</p>
                      <p className="font-medium">{formatDate(selectedCert.nextSurveyDue)}</p>
                    </div>
                  </div>
                  {selectedCert.notes && (
                    <div>
                      <p className="text-sm text-muted-foreground">Notes</p>
                      <p className="mt-1">{selectedCert.notes}</p>
                    </div>
                  )}
                  {selectedCert.documentUrl && (
                    <div>
                      <p className="text-sm text-muted-foreground">Document</p>
                      <a
                        href={selectedCert.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                        data-testid="link-document-url"
                      >
                        View Document
                      </a>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setIsDetailOpen(false);
                        handleEdit(selectedCert);
                      }}
                      data-testid="button-detail-edit"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-destructive"
                      onClick={() => {
                        setIsDetailOpen(false);
                        handleDeleteClick(selectedCert);
                      }}
                      data-testid="button-detail-delete"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        <CertificateFormDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          mode="create"
          vessels={vessels}
          equipmentList={equipmentList}
        />

        <CertificateFormDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          mode="edit"
          initialData={selectedCert}
          vessels={vessels}
          equipmentList={equipmentList}
        />

        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Certificate</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{selectedCert?.certificateName}"? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedCert && deleteMutation.mutate(selectedCert.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-delete-confirm"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
