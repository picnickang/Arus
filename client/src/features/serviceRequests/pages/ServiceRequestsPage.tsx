import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, ClipboardList, AlertCircle, Clock, CheckCircle, Loader2 } from "lucide-react";
import { useServiceRequests, useCreateServiceRequest, useCreateServiceOrderFromSR, useCreatePRFromSR } from "../hooks/useServiceRequests";
import { SRCard } from "../components/SRCard";
import type { SRFilters, SRStatus } from "../types";

interface CreateSODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  srId: string | null;
  onSubmit: (data: { serviceProviderId: string; scope: string }) => void;
  isPending: boolean;
}

function CreateSODialog({ open, onOpenChange, srId: _srId, onSubmit, isPending }: CreateSODialogProps) {
  const [scope, setScope] = useState("");
  const [serviceProviderId, setServiceProviderId] = useState("");
  const { data: suppliers } = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/suppliers"] });

  const handleSubmit = () => {
    if (!serviceProviderId) {return;}
    onSubmit({ serviceProviderId, scope });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Service Order</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Service Provider *</Label>
            <Select value={serviceProviderId} onValueChange={setServiceProviderId}>
              <SelectTrigger data-testid="select-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                {suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Scope of Work</Label>
            <Textarea value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Describe the work scope..." data-testid="input-scope" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="btn-cancel-create-so">Cancel</Button>
          <Button onClick={handleSubmit} disabled={!serviceProviderId || isPending} data-testid="btn-submit-so">
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Service Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CreateSRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; description: string; priority: string }) => void;
  isPending: boolean;
}

function CreateSRDialog({ open, onOpenChange, onSubmit, isPending }: CreateSRDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  const handleSubmit = () => {
    if (!title.trim()) {return;}
    onSubmit({ title: title.trim(), description: description.trim(), priority });
    setTitle("");
    setDescription("");
    setPriority("medium");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Service Request</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief description of the issue..." data-testid="input-sr-title" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detailed description..." data-testid="input-sr-description" />
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="btn-cancel-create-sr">Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || isPending} data-testid="btn-submit-sr">
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Request
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateSOOpen, setIsCreateSOOpen] = useState(false);
  const [selectedSRId, setSelectedSRId] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useServiceRequests(filters);
  const createMutation = useCreateServiceRequest();
  const createSOMutation = useCreateServiceOrderFromSR();
  const createPRMutation = useCreatePRFromSR();

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    inProgress: requests.filter((r) => r.status === "in_progress").length,
    completed: requests.filter((r) => r.status === "completed").length,
  };

  const handleSearch = () => setFilters((prev) => ({ ...prev, search: searchInput || undefined }));
  const handleStatusChange = (value: string) => setFilters((prev) => ({ ...prev, status: (value === "all" ? undefined : value) as SRStatus | undefined }));
  const handlePriorityChange = (value: string) => setFilters((prev) => ({ ...prev, priority: value === "all" ? undefined : value }));

  const handleCreateSR = (data: { title: string; description: string; priority: string }) => {
    createMutation.mutate({ title: data.title, description: data.description, priority: data.priority as "low" | "medium" | "high" | "critical", status: "pending" }, {
      onSuccess: () => { toast({ title: "Service Request created" }); setIsCreateOpen(false); },
      onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
    });
  };

  const handleCreateSO = (id: string) => { setSelectedSRId(id); setIsCreateSOOpen(true); };

  const handleSubmitSO = (data: { serviceProviderId: string; scope: string }) => {
    if (!selectedSRId) {return;}
    createSOMutation.mutate({ workOrderId: selectedSRId, data }, {
      onSuccess: () => { toast({ title: "Service Order created" }); setIsCreateSOOpen(false); setSelectedSRId(null); },
      onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
    });
  };

  const handleCreatePR = (id: string) => {
    createPRMutation.mutate({ workOrderId: id, data: { requestedBy: "Service Request" } }, {
      onSuccess: (pr: { id: string }) => { toast({ title: "Purchase Request created" }); setLocation(`/purchase-requests/${pr.id}`); },
      onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
    });
  };

  const handleViewDetails = (id: string) => setLocation(`/work-orders?id=${id}`);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={() => setIsCreateOpen(true)} data-testid="btn-new-sr">
          <Plus className="h-4 w-4 mr-2" /> New Service Request
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="stat-total-sr">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /><span className="text-2xl font-bold">{stats.total}</span></div></CardContent>
        </Card>
        <Card data-testid="stat-pending-sr">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-yellow-500" /><span className="text-2xl font-bold">{stats.pending}</span></div></CardContent>
        </Card>
        <Card data-testid="stat-in-progress-sr">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-blue-500" /><span className="text-2xl font-bold">{stats.inProgress}</span></div></CardContent>
        </Card>
        <Card data-testid="stat-completed-sr">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /><span className="text-2xl font-bold">{stats.completed}</span></div></CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2 flex-1 min-w-[250px]">
          <Input placeholder="Search requests..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} data-testid="input-search-sr" />
          <Button variant="outline" onClick={handleSearch} data-testid="btn-search-sr"><Search className="h-4 w-4" /></Button>
        </div>
        <Select value={filters.status || "all"} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[150px]" data-testid="select-status-filter-sr"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.priority || "all"} onValueChange={handlePriorityChange}>
          <SelectTrigger className="w-[150px]" data-testid="select-priority-filter-sr"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading service requests...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-no-requests">No service requests found. Create a new request to get started.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {requests.map((sr) => (
            <SRCard key={sr.id} sr={sr} onCreateSO={handleCreateSO} onCreatePR={handleCreatePR} onViewDetails={handleViewDetails} />
          ))}
        </div>
      )}

      <CreateSRDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSubmit={handleCreateSR} isPending={createMutation.isPending} />
      <CreateSODialog open={isCreateSOOpen} onOpenChange={setIsCreateSOOpen} srId={selectedSRId} onSubmit={handleSubmitSO} isPending={createSOMutation.isPending} />
    </div>
  );
}
