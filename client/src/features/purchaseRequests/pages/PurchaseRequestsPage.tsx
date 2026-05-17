// @ts-nocheck
import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Filter } from "lucide-react";
import { usePurchaseRequests, useCreatePR } from "../hooks/usePurchaseRequests";
import { PRCard } from "../components/PRCard";
import type { PurchaseRequest, PRStatus, PRFilters } from "../types";
import { PR_STATUS_LABELS } from "../types";

export function PurchaseRequestsPage() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<PRStatus | "all">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [requestedBy, setRequestedBy] = useState("");

  const { toast } = useToast();

  const filters: PRFilters = statusFilter !== "all" ? { status: statusFilter } : {};
  const { data: prs, isLoading, error } = usePurchaseRequests(filters);
  const createMutation = useCreatePR();

  const handleCreate = () => {
    if (!requestedBy.trim()) {
      toast({ title: "Error", description: "Requester name is required", variant: "destructive" });
      return;
    }
    createMutation.mutate(
      { requestedBy: requestedBy.trim() },
      {
        onSuccess: (pr: PurchaseRequest) => {
          toast({ title: "Purchase Request created" });
          setIsCreateOpen(false);
          setRequestedBy("");
          setLocation(`/purchase-requests/${pr.id}`);
        },
        onError: (err) =>
          toast({ title: "Error", description: String(err), variant: "destructive" }),
      }
    );
  };

  const handleView = (pr: PurchaseRequest) => setLocation(`/purchase-requests/${pr.id}`);

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load purchase requests: {String(error)}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-pr">
          <Plus className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </div>
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PRStatus | "all")}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {(Object.keys(PR_STATUS_LABELS) as PRStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {PR_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{prs?.length ?? 0} requests</p>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6 space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prs?.map((pr) => (
            <PRCard key={pr.id} pr={pr} onView={handleView} onEdit={handleView} />
          ))}
          {prs?.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No purchase requests found</p>
                <Button variant="outline" className="mt-4" onClick={() => setIsCreateOpen(true)}>
                  Create your first request
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Purchase Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Requested By *</label>
              <Input
                value={requestedBy}
                onChange={(e) => setRequestedBy(e.target.value)}
                placeholder="Your name"
                data-testid="input-requested-by"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                data-testid="button-submit-create"
              >
                Create Draft
              </Button>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
