import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, ExternalLink, CheckCircle, XCircle, Eye, ArrowRightCircle } from "lucide-react";
import { SRStatusBadge } from "./SRStatusBadge";
import { SRPriorityBadge } from "./SRPriorityBadge";
import type { ServiceRequest } from "../types";

interface SRCardProps {
  sr: ServiceRequest;
  onReview?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onConvert?: (id: string) => void;
  onViewDetails?: (id: string) => void;
}

export function SRCard({ sr, onReview, onApprove, onReject, onConvert, onViewDetails }: SRCardProps) {
  const isPending = sr.status === "pending_review";
  const isUnderReview = sr.status === "under_review";
  const isApproved = sr.status === "approved";

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`card-sr-${sr.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] text-muted-foreground font-mono">{sr.requestNumber}</span>
            <CardTitle className="text-base font-medium line-clamp-2 mt-0.5">{sr.title}</CardTitle>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <SRStatusBadge status={sr.status} />
            <SRPriorityBadge priority={sr.urgency} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sr.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{sr.description}</p>
        )}
        {sr.workOrderNumber && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">WO:</span> {sr.workOrderNumber}
          </div>
        )}
        {sr.estimatedCost != null && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Est. Cost:</span> ${Number(sr.estimatedCost).toLocaleString()}
          </div>
        )}
        {sr.rejectionReason && (
          <div className="text-xs text-red-600 dark:text-red-400">
            <span className="font-medium">Reason:</span> {sr.rejectionReason}
          </div>
        )}
        <div className="text-[10px] text-muted-foreground">
          Requested by {sr.requestedBy} on {new Date(sr.createdAt).toLocaleDateString()}
        </div>
        <div className="flex gap-2 pt-2 flex-wrap">
          {isPending && onReview && (
            <Button size="sm" variant="outline" onClick={() => onReview(sr.id)} data-testid={`btn-review-sr-${sr.id}`}>
              <Eye className="h-3 w-3 mr-1" /> Review
            </Button>
          )}
          {(isPending || isUnderReview) && onApprove && (
            <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20" onClick={() => onApprove(sr.id)} data-testid={`btn-approve-sr-${sr.id}`}>
              <CheckCircle className="h-3 w-3 mr-1" /> Approve
            </Button>
          )}
          {(isPending || isUnderReview) && onReject && (
            <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => onReject(sr.id)} data-testid={`btn-reject-sr-${sr.id}`}>
              <XCircle className="h-3 w-3 mr-1" /> Reject
            </Button>
          )}
          {isApproved && onConvert && (
            <Button size="sm" onClick={() => onConvert(sr.id)} data-testid={`btn-convert-sr-${sr.id}`}>
              <ArrowRightCircle className="h-3 w-3 mr-1" /> Convert to SO
            </Button>
          )}
          {onViewDetails && (
            <Button size="sm" variant="ghost" onClick={() => onViewDetails(sr.id)} data-testid={`btn-view-sr-${sr.id}`}>
              <ExternalLink className="h-3 w-3 mr-1" /> WO Details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
