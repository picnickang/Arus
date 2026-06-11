import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { EditServiceRequestDialog } from "../components/EditServiceRequestDialog";
import type { ServiceRequest } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, AlertCircle, CheckCircle, Loader2, ArrowRightCircle } from "lucide-react";
import {
  useServiceRequests,
  useReviewServiceRequest,
  useApproveServiceRequest,
  useRejectServiceRequest,
  useConvertServiceRequest,
} from "../hooks/useServiceRequests";
import { SRCard } from "../components/SRCard";
import type { SRFilters, SRStatus, SRSortBy } from "../types";
import {
  ConvertToSODialog,
  RejectDialog,
  type ConvertToSOData,
} from "./ServiceRequestsPageDialogs";

export function ServiceRequestsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [filters, setFilters] = useState<SRFilters>({});
  const [searchInput, setSearchInput] = useState("");
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSr, setEditingSr] = useState<ServiceRequest | null>(null);
  const [selectedSRId, setSelectedSRId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useServiceRequests(filters);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const focus = params.get("focus");
    if (!focus) {
      return;
    }
    setFocusedId(focus);
    const scrollTimer = window.setTimeout(() => {
      const el = document.getElementById(`sr-card-${focus}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 200);
    const clearTimer = window.setTimeout(() => setFocusedId(null), 1800);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [requests]);
  const reviewMutation = useReviewServiceRequest();
  const approveMutation = useApproveServiceRequest();
  const rejectMutation = useRejectServiceRequest();
  const convertMutation = useConvertServiceRequest();

  const filteredRequests = searchInput
    ? requests.filter(
        (r) =>
          r.title.toLowerCase().includes(searchInput.toLowerCase()) ||
          r.requestNumber.toLowerCase().includes(searchInput.toLowerCase()) ||
          r.workOrderNumber?.toLowerCase().includes(searchInput.toLowerCase()) ||
          r.vesselName?.toLowerCase().includes(searchInput.toLowerCase()) ||
          r.equipmentName?.toLowerCase().includes(searchInput.toLowerCase())
      )
    : requests;

  const stats = {
    total: requests.length,
    pendingReview: requests.filter(
      (r) => r.status === "pending_review" || r.status === "under_review"
    ).length,
    approved: requests.filter((r) => r.status === "approved").length,
    converted: requests.filter((r) => r.status === "converted").length,
  };

  const handleStatusChange = (value: string) =>
    setFilters((prev) => {
      const { status: _, ...rest } = prev;
      return value === "all" ? rest : { ...rest, status: value as SRStatus | "actionable" };
    });

  const handleReview = (id: string) => {
    reviewMutation.mutate(id, {
      onSuccess: () => toast({ title: "Request marked as under review" }),
      onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
    });
  };

  const handleApprove = (id: string) => {
    approveMutation.mutate(id, {
      onSuccess: () =>
        toast({
          title: "Request approved",
          description: "You can now convert it to a Service Order.",
        }),
      onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
    });
  };

  const handleReject = (id: string) => {
    setSelectedSRId(id);
    setRejectDialogOpen(true);
  };

  const handleRejectSubmit = (reason: string) => {
    if (!selectedSRId) {
      return;
    }
    rejectMutation.mutate(
      { id: selectedSRId, reason },
      {
        onSuccess: () => {
          toast({ title: "Request rejected", description: "Work order status has been restored." });
          setRejectDialogOpen(false);
          setSelectedSRId(null);
        },
        onError: (err) =>
          toast({ title: "Error", description: String(err), variant: "destructive" }),
      }
    );
  };

  const handleConvert = (id: string) => {
    setSelectedSRId(id);
    setConvertDialogOpen(true);
  };

  const handleConvertSubmit = (data: ConvertToSOData) => {
    if (!selectedSRId) {
      return;
    }
    convertMutation.mutate(
      { id: selectedSRId, data },
      {
        onSuccess: () => {
          toast({
            title: "Service Order created",
            description: "Request has been converted to a formal Service Order.",
          });
          setConvertDialogOpen(false);
          setSelectedSRId(null);
        },
        onError: (err) =>
          toast({ title: "Error", description: String(err), variant: "destructive" }),
      }
    );
  };

  const handleViewDetails = (id: string) => {
    const sr = requests.find((r) => r.id === id);
    if (sr?.workOrderId) {
      setLocation(`/work-orders?id=${sr.workOrderId}`);
    }
  };

  const handleEdit = (sr: ServiceRequest) => {
    setEditingSr(sr);
    setEditDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Service Requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Procurement queue — review, approve, and convert service requests to formal orders.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="stat-total-sr">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-pending-sr">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold">{stats.pendingReview}</span>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-approved-sr">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{stats.approved}</span>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-converted-sr">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Converted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ArrowRightCircle className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{stats.converted}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2 flex-1 min-w-[250px]">
          <Input
            placeholder="Search by title, number, or WO..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            data-testid="input-search-sr"
          />
        </div>
        <Select value={filters.status || "all"} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter-sr">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="actionable">Actionable</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.sortBy || "created"}
          onValueChange={(v: string) =>
            setFilters((prev) => {
              const { sortBy: _, ...rest } = prev;
              return v === "created" ? rest : { ...rest, sortBy: v as SRSortBy };
            })
          }
        >
          <SelectTrigger className="w-[160px]" data-testid="select-sort-sr">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created">Newest First</SelectItem>
            <SelectItem value="urgency">By Urgency</SelectItem>
            <SelectItem value="vessel">By Vessel</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading service requests...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-no-requests">
          {requests.length === 0
            ? "No service requests yet. Engineers create requests from Work Order detail drawers."
            : "No requests match your filters."}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRequests.map((sr) => (
            <SRCard
              key={sr.id}
              sr={sr}
              onReview={handleReview}
              onApprove={handleApprove}
              onReject={handleReject}
              onConvert={handleConvert}
              onEdit={handleEdit}
              onViewDetails={handleViewDetails}
              highlighted={focusedId === sr.id}
            />
          ))}
        </div>
      )}

      <ConvertToSODialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        srId={selectedSRId}
        onSubmit={handleConvertSubmit}
        isPending={convertMutation.isPending}
      />
      <RejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        srId={selectedSRId}
        onSubmit={handleRejectSubmit}
        isPending={rejectMutation.isPending}
      />
      <EditServiceRequestDialog
        open={editDialogOpen}
        onOpenChange={(o) => {
          setEditDialogOpen(o);
          if (!o) {
            setEditingSr(null);
          }
        }}
        serviceRequest={editingSr}
      />
    </div>
  );
}
