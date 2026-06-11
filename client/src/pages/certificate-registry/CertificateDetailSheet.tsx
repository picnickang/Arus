import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AlertTriangle, Pencil, Shield, Trash2 } from "lucide-react";
import type { VesselCertificate } from "@shared/schema";
import { AUTHORITY_TYPE_LABELS, CERT_STATUS_LABELS, CERT_TYPE_LABELS } from "./constants";
import { formatDate, getCertExpiryStatus, getStatusBadgeClass } from "./utils";

export function CertificateDetailSheet({
  open,
  onOpenChange,
  selectedCert,
  vesselMap,
  equipmentMap,
  onEdit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCert: VesselCertificate | null;
  vesselMap: Map<string, string>;
  equipmentMap: Map<string, string>;
  onEdit: (cert: VesselCertificate) => void;
  onDelete: (cert: VesselCertificate) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
                    {CERT_TYPE_LABELS[selectedCert.certificateType] || selectedCert.certificateType}
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
                    {AUTHORITY_TYPE_LABELS[
                      (selectedCert as { issuingAuthorityType?: string }).issuingAuthorityType ?? ""
                    ] ||
                      (selectedCert as { issuingAuthorityType?: string }).issuingAuthorityType ||
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
                    onOpenChange(false);
                    onEdit(selectedCert);
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
                    onOpenChange(false);
                    onDelete(selectedCert);
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
  );
}
