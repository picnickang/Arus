import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Pencil, Ship, Trash2 } from "lucide-react";
import type { VesselCertificate } from "@shared/schema";
import { CERT_STATUS_LABELS, CERT_TYPE_LABELS, PAGE_SIZE } from "./constants";
import { formatDate, getCertExpiryStatus, getStatusBadgeClass } from "./utils";

export function CertificatesTable({
  paginatedCerts,
  filteredCount,
  page,
  totalPages,
  hasActiveFilters,
  vesselMap,
  equipmentMap,
  onView,
  onEdit,
  onDelete,
  onPageChange,
}: {
  paginatedCerts: VesselCertificate[];
  filteredCount: number;
  page: number;
  totalPages: number;
  hasActiveFilters: boolean;
  vesselMap: Map<string, string>;
  equipmentMap: Map<string, string>;
  onView: (cert: VesselCertificate) => void;
  onEdit: (cert: VesselCertificate) => void;
  onDelete: (cert: VesselCertificate) => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="p-0">
      <Table data-testid="table-certificates">
        <TableHeader>
          <TableRow>
            <TableHead>Certificate Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Vessel</TableHead>
            <TableHead>Equipment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expiry Date</TableHead>
            <TableHead>Issuer</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedCerts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                {hasActiveFilters ? "No certificates match your filters" : "No certificates found"}
              </TableCell>
            </TableRow>
          ) : (
            paginatedCerts.map((cert) => {
              const expiryStatus = getCertExpiryStatus(cert.expiryDate);
              return (
                <TableRow
                  key={cert.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => onView(cert)}
                  data-testid={`row-certificate-${cert.id}`}
                >
                  <TableCell>
                    <div className="font-medium">{cert.certificateName}</div>
                    {cert.certificateNumber && (
                      <div className="text-xs text-muted-foreground">#{cert.certificateNumber}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {CERT_TYPE_LABELS[cert.certificateType] || cert.certificateType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Ship className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-sm">
                        {vesselMap.get(cert.vesselId) || cert.vesselId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {cert.equipmentId ? (
                      <span className="text-sm">
                        {equipmentMap.get(cert.equipmentId) || cert.equipmentId}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusBadgeClass(cert.status)}>
                      {CERT_STATUS_LABELS[cert.status] || cert.status}
                    </Badge>
                    {expiryStatus &&
                      cert.status === "valid" &&
                      expiryStatus.level !== "current" && (
                        <Badge className={`ml-1 ${expiryStatus.badgeClass}`}>
                          {expiryStatus.label}
                        </Badge>
                      )}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(cert.expiryDate)}</TableCell>
                  <TableCell className="text-sm">{cert.issuingAuthority}</TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      role="presentation"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(cert);
                        }}
                        data-testid={`button-edit-${cert.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(cert);
                        }}
                        data-testid={`button-delete-${cert.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredCount)} of{" "}
            {filteredCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
