import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { VesselCertificate } from "@shared/schema";

import { PAGE_SIZE } from "./constants";
import { CertificateFormDialog } from "./CertificateFormDialog";
import { SummaryCards, type CertSummary } from "./SummaryCards";
import { FilterBar } from "./FilterBar";
import { CertificatesTable } from "./CertificatesTable";
import { CertificateDetailSheet } from "./CertificateDetailSheet";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { LoadingSkeleton } from "./LoadingSkeleton";

export { CERT_TYPE_LABELS } from "./constants";
export { getCertExpiryStatus } from "./utils";

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
    queryParams["vesselId"] = vesselFilter;
  }
  if (typeFilter !== "all") {
    queryParams["type"] = typeFilter;
  }
  if (statusFilter !== "all") {
    queryParams["status"] = statusFilter;
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

  const summary: CertSummary | undefined = rawSummary
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
    return <LoadingSkeleton />;
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

        <SummaryCards summary={summary} />

        <Card>
          <FilterBar
            searchQuery={searchQuery}
            vesselFilter={vesselFilter}
            typeFilter={typeFilter}
            statusFilter={statusFilter}
            equipmentFilter={equipmentFilter}
            vessels={vessels}
            equipmentList={equipmentList}
            hasActiveFilters={hasActiveFilters}
            onSearchChange={(v) => {
              setSearchQuery(v);
              setPage(1);
            }}
            onVesselChange={(v) => {
              setVesselFilter(v);
              setPage(1);
            }}
            onTypeChange={(v) => {
              setTypeFilter(v);
              setPage(1);
            }}
            onStatusChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            onEquipmentChange={(v) => {
              setEquipmentFilter(v);
              setPage(1);
            }}
            onClear={clearFilters}
          />
          <CertificatesTable
            paginatedCerts={paginatedCerts}
            filteredCount={filteredCerts.length}
            page={page}
            totalPages={totalPages}
            hasActiveFilters={hasActiveFilters}
            vesselMap={vesselMap}
            equipmentMap={equipmentMap}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            onPageChange={setPage}
          />
        </Card>

        <CertificateDetailSheet
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          selectedCert={selectedCert}
          vesselMap={vesselMap}
          equipmentMap={equipmentMap}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
        />

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

        <DeleteConfirmDialog
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          certName={selectedCert?.certificateName}
          isDeleting={deleteMutation.isPending}
          onConfirm={() => selectedCert && deleteMutation.mutate(selectedCert.id)}
        />
      </div>
    </div>
  );
}
