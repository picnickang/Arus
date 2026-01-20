import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, FileText, ExternalLink } from "lucide-react";
import { SRStatusBadge } from "./SRStatusBadge";
import { SRPriorityBadge } from "./SRPriorityBadge";
import type { ServiceRequest } from "../types";

interface SRCardProps {
  sr: ServiceRequest;
  onCreateSO?: (id: string) => void;
  onCreatePR?: (id: string) => void;
  onViewDetails?: (id: string) => void;
}

export function SRCard({ sr, onCreateSO, onCreatePR, onViewDetails }: SRCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`card-sr-${sr.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-medium line-clamp-2">{sr.title}</CardTitle>
          <div className="flex gap-1 flex-shrink-0">
            <SRStatusBadge status={sr.status} />
            <SRPriorityBadge priority={sr.priority} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sr.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{sr.description}</p>
        )}
        {sr.probableCause && (
          <div className="text-xs">
            <span className="font-medium">Probable Cause:</span> {sr.probableCause}
          </div>
        )}
        {sr.mocRequired && (
          <div className="text-xs flex items-center gap-1">
            <span className="font-medium">MOC:</span>
            <span className={sr.mocApproved ? "text-green-600" : "text-yellow-600"}>
              {sr.mocApproved ? "Approved" : "Required"}
            </span>
          </div>
        )}
        <div className="flex gap-2 pt-2 flex-wrap">
          {onCreateSO && sr.status !== "completed" && sr.status !== "cancelled" && (
            <Button size="sm" variant="outline" onClick={() => onCreateSO(sr.id)} data-testid={`btn-create-so-${sr.id}`}>
              <Wrench className="h-3 w-3 mr-1" /> Create SO
            </Button>
          )}
          {onCreatePR && sr.status !== "completed" && sr.status !== "cancelled" && (
            <Button size="sm" variant="outline" onClick={() => onCreatePR(sr.id)} data-testid={`btn-create-pr-${sr.id}`}>
              <FileText className="h-3 w-3 mr-1" /> Create PR
            </Button>
          )}
          {onViewDetails && (
            <Button size="sm" variant="ghost" onClick={() => onViewDetails(sr.id)} data-testid={`btn-view-sr-${sr.id}`}>
              <ExternalLink className="h-3 w-3 mr-1" /> Details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
