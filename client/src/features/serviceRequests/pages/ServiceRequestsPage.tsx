import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, ClipboardList, AlertCircle, Clock, CheckCircle, Loader2, XCircle, ArrowRightCircle } from "lucide-react";
import {
  useServiceRequests,
  useReviewServiceRequest,
  useApproveServiceRequest,
  useRejectServiceRequest,
  useConvertServiceRequest,
} from "../hooks/useServiceRequests";
import { SRCard } from "../components/SRCard";
import type { SRFilters, SRStatus } from "../types";

interface ConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  srId: string | null;
  isPending: boolean;
  onSubmit: (data: { serviceProviderId: string; scope?: string; estimatedCost?: number; scheduledStartDate?: string }) => void;
}

function ConvertToSODialog({ open, onOpenChange, srId: _srId, onSubmit, isPending }: ConvertDialogProps) {
  const [scope, setScope] = useState("");
  const [serviceProviderId, setServiceProviderId] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [scheduledStartDate, setScheduledStartDate] = useState("");
  const { data: suppliers } = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/suppliers"], enabled: open });

  const handleSubmit = () => {
    if (!serviceProviderId) return;
    onSubmit({
      serviceProviderId,
      scope: scope || undefined,
      estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
      scheduledStartDate: scheduledStartDate || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to Service Order</DialogTitle>
          <DialogDescription>Create a formal service order from this approved request.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Service Provider *</Label>
            <Select value={serviceProviderId} onValueChange={setServiceProviderId}>
              <SelectTrigger data-testid="select-convert-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                {suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Scope of Work</Label>
            <Textarea value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Describe the work scope..." data-testid="input-convert-scope" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Estimated Cost</Label>
              <Input type="number" step="0.01" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} placeholder="0.00" data-testid="input-convert-cost" />
            </div>
            <div>
              <Label>Scheduled Start</Label>
              <Input type="date" value={scheduledStartDate} onChange={(e) => setScheduledStartDate(e.target.value)} data-testid="input-convert-date" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="btn-cancel-convert">Cancel</Button>
          <Button onClick={handleSubmit} disabled={!serviceProviderId || isPending} data-testid="btn-submit-convert">
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <ArrowRightCircle className="h-4 w-4 mr-2" /> Convert to SO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  srId: string | null;
  isPending: boolean;
  onSubmit: (reason: string) => void;
}

function RejectDialog({ open, onOpenChange, srId: _srId, onSubmit, isPending }: RejectDialogProps) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Service Request</DialogTitle>
          <DialogDescription>Provide a reason for rejecting this request. The work order status will be restored.</DialogDescription>
        </DialogHeader>
        <div>
          <Label>Reason</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why this request is being rejected..." data-testid="input-reject-reason" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="btn-cancel-reject">Cancel</Button>
          <Button variant="destructive" onClick={() => onSubmit(reason)} disabled={isPending} data-testid="btn-submit-reject">
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <XCircle className="h-4 w-4 mr-2" /> Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ServiceRequestsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [filters, setFilters] = useState<SRFilters>({});
  const [searchInput, setSearchInput] = useState("");
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedSRId, setSelectedSRId] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useServiceRequests(filters);
  const reviewMutation = useReviewServiceRequest();
  const approveMutation = useApproveServiceRequest();
  const rejectMutation = useRejectServiceRequest();
  const convertMutation = useConvertServiceRequest();

  const filteredRequests = searchInput
    ? requests.filter((r) =>
        r.title.toLowerCase().includes(searchInput.toLowerCase()) ||
        r.requestNumber.toLowerCase().includes(searchInput.toLowerCase()) ||
        (r.workOrderNumber && r.workOrderNumber.toLowerCase().includes(searchInput.toLowerCase()))
      )
    : requests;

  const stats = {
    total: requests.length,
    pendingReview: requests.filter((r) => r.status === "pending_review" || r.status === "under_review").length,
    approved: requests.filter((r) => r.status === "approved").length,
    converted: requests.filter((r) => r.status === "converted").length,
  };

  const handleStatusChange = (value: string) =>
    setFilters((prev) => ({ ...prev, status: (value === "all" ? undefined : value) as SRStatus | undefined }));

  const handleReview = (id: string) => {
    reviewMutation.mutate(id, {
      onSuccess: () => toast({ title: "Request marked as under review" }),
      onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
    });
  };

  const handleApprove = (id: string) => {
    approveMutation.mutate(id, {
      onSuccess: () => toast({ title: "Request approved", description: "You can now convert it to a Service Order." }),
      onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
    });
  };

  const handleReject = (id: string) => {
    setSelectedSRId(id);
    setRejectDialogOpen(true);
  };

  const handleRejectSubmit = (reason: string) => {
    if (!selectedSRId) return;
    rejectMutation.mutate({ id: selectedSRId, reason }, {
      onSuccess: () => {
        toast({ title: "Request rejected", description: "Work order status has been restored." });
        setRejectDialogOpen(false);
        setSelectedSRId(null);
      },
      onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
    });
  };

  const handleConvert = (id: string) => {
    setSelectedSRId(id);
    setConvertDialogOpen(true);
  };

  const handleConvertSubmit = (data: { serviceProviderId: string; scope?: string; estimatedCost?: number; scheduledStartDate?: string }) => {
    if (!selectedSRId) return;
    convertMutation.mutate({ id: selectedSRId, data }, {
      onSuccess: () => {
        toast({ title: "Service Order created", description: "Request has been converted to a formal Service Order." });
        setConvertDialogOpen(false);
        setSelectedSRId(null);
      },
      onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
    });
  };

  const handleViewDetails = (id: string) => {
    const sr = requests.find((r) => r.id === id);
    if (sr?.workOrderId) {
      setLocation(`/work-orders?id=${sr.workOrderId}`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Service Requests</h1>
          <p className="text-sm text-muted-foreground">Procurement queue — review, approve, and convert service requests to formal orders.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="stat-total-sr">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /><span className="text-2xl font-bold">{stats.total}</span></div></CardContent>
        </Card>
        <Card data-testid="stat-pending-sr">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-yellow-500" /><span className="text-2xl font-bold">{stats.pendingReview}</span></div></CardContent>
        </Card>
        <Card data-testid="stat-approved-sr">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /><span className="text-2xl font-bold">{stats.approved}</span></div></CardContent>
        </Card>
        <Card data-testid="stat-converted-sr">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Converted</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><ArrowRightCircle className="h-5 w-5 text-primary" /><span className="text-2xl font-bold">{stats.converted}</span></div></CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2 flex-1 min-w-[250px]">
          <Input placeholder="Search by title, number, or WO..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} data-testid="input-search-sr" />
        </div>
        <Select value={filters.status || "all"} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter-sr"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
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
              onViewDetails={handleViewDetails}
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
    </div>
  );
}
