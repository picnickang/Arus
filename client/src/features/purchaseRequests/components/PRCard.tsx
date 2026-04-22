import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, MapPin, User, Eye, Edit } from "lucide-react";
import { format } from "date-fns";
import type { PurchaseRequest } from "../types";
import { PRStatusBadge } from "./PRStatusBadge";

interface PRCardProps {
  pr: PurchaseRequest;
  onView?: (pr: PurchaseRequest) => void;
  onEdit?: (pr: PurchaseRequest) => void;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) {
    return "-";
  }
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy");
}

export function PRCard({ pr, onView, onEdit }: PRCardProps) {
  const isEditable = pr.status === "draft";

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`card-pr-${pr.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{pr.prNumber}</CardTitle>
          </div>
          <PRStatusBadge status={pr.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span>Requested by: {pr.requestedBy}</span>
        </div>
        {pr.requiredByDate && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Required by: {formatDate(pr.requiredByDate)}</span>
          </div>
        )}
        {pr.deliveryLocation && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{pr.deliveryLocation}</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground pt-2">
          Created: {formatDate(pr.createdAt)}
        </div>
        <div className="flex gap-2 pt-3 border-t">
          {onView && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(pr)}
              data-testid={`button-view-pr-${pr.id}`}
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          )}
          {isEditable && onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(pr)}
              data-testid={`button-edit-pr-${pr.id}`}
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
