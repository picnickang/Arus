import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Send, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { usePurchaseRequest, useAddPRItem, useRemovePRItem, useSendPR, useCancelPR } from "../hooks/usePurchaseRequests";
import { PRStatusBadge } from "../components/PRStatusBadge";
import { PRItemsTable } from "../components/PRItemsTable";
import { AddItemDialog } from "../components/AddItemDialog";
import type { PRItemFormData } from "../types";

export function PRDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  const { data: pr, isLoading, error } = usePurchaseRequest(id);
  const addItemMutation = useAddPRItem();
  const removeItemMutation = useRemovePRItem();
  const sendMutation = useSendPR();
  const cancelMutation = useCancelPR();

  const handleAddItem = (data: PRItemFormData) => {
    addItemMutation.mutate({ prId: id, ...data }, {
      onSuccess: () => {
        toast({ title: "Item added" });
        setIsAddItemOpen(false);
      },
      onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
    });
  };

  const handleRemoveItem = (itemId: string) => {
    removeItemMutation.mutate({ prId: id, itemId }, {
      onSuccess: () => toast({ title: "Item removed" }),
      onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
    });
  };

  const handleSend = () => {
    sendMutation.mutate(id, {
      onSuccess: (result) => {
        toast({ title: "Purchase Request Sent", description: `Created ${result.purchaseOrders.length} POs, ${result.emailsQueued} emails queued` });
        setIsSendDialogOpen(false);
      },
      onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
    });
  };

  const handleCancel = () => {
    cancelMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: "Purchase Request Cancelled" });
        setIsCancelDialogOpen(false);
      },
      onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
    });
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load: {String(error)}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !pr) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Card><CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
      </div>
    );
  }

  const isEditable = pr.status === "draft";
  const canSend = isEditable && pr.items && pr.items.length > 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => setLocation("/purchase-requests")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" data-testid="text-pr-number">{pr.prNumber}</h1>
            <PRStatusBadge status={pr.status} />
          </div>
          <p className="text-muted-foreground">Requested by {pr.requestedBy} on {format(new Date(pr.createdAt), "MMM d, yyyy")}</p>
        </div>
        {isEditable && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCancelDialogOpen(true)} data-testid="button-cancel-pr">
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={() => setIsSendDialogOpen(true)} disabled={!canSend} data-testid="button-send-pr">
              <Send className="h-4 w-4 mr-2" />
              Send to Suppliers
            </Button>
          </div>
        )}
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Items</CardTitle>
              <CardDescription>{pr.items?.length || 0} items in this request</CardDescription>
            </div>
            {isEditable && (
              <Button onClick={() => setIsAddItemOpen(true)} data-testid="button-add-item">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <PRItemsTable items={pr.items ?? []} isEditable={isEditable} onRemove={handleRemoveItem} isRemoving={removeItemMutation.isPending} />
        </CardContent>
      </Card>
      <AddItemDialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen} onSubmit={handleAddItem} isPending={addItemMutation.isPending} />
      <AlertDialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Purchase Request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will convert your request into purchase orders grouped by supplier and queue emails to be sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={sendMutation.isPending} data-testid="button-confirm-send">
              {sendMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Purchase Request?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-cancel">
              Cancel Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
