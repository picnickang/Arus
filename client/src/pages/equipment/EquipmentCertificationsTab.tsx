import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { ExternalLink, Shield } from "lucide-react";
import { CERT_TYPE_LABELS, getCertExpiryStatus } from "@/pages/certificate-registry";
import type { CertSummary } from "./types";

export function EquipmentCertificationsTab({
  equipmentId,
  equipmentName: _equipmentName,
  allCerts,
  setLocation,
}: {
  equipmentId: string;
  equipmentName: string;
  allCerts: CertSummary[];
  setLocation: (path: string) => void;
}) {
  const eqCerts = allCerts.filter((c) => c.equipmentId === equipmentId);
  return (
    <TabsContent value="certs" className="space-y-4 mt-4">
      {eqCerts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No certificates linked to this equipment</p>
          <p className="text-sm mt-1">Add certificates from the Certificate Registry</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setLocation("/certificates")}
            data-testid="link-cert-registry"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Certificate Registry
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {eqCerts.map((cert) => {
              const expiryStatus = getCertExpiryStatus(cert.expiryDate);
              return (
                <div
                  key={cert.id}
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                  data-testid={`cert-row-${cert.id}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{cert.certificateName}</p>
                      <p className="text-xs text-muted-foreground">
                        {CERT_TYPE_LABELS[cert.certificateType || ""] || cert.certificateType}
                        {cert.certificateNumber && ` • ${cert.certificateNumber}`}
                      </p>
                      {cert.issuingAuthority && (
                        <p className="text-xs text-muted-foreground">
                          Issued by: {cert.issuingAuthority}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {expiryStatus && (
                        <Badge variant="secondary" className={`text-xs ${expiryStatus.badgeClass}`}>
                          {expiryStatus.label}
                        </Badge>
                      )}
                      {cert.status && cert.status !== "valid" && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {cert.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {cert.expiryDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Expires: {new Date(cert.expiryDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setLocation(`/certificates?equipmentId=${equipmentId}`)}
            data-testid="link-cert-registry-filtered"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View in Certificate Registry
          </Button>
        </>
      )}
    </TabsContent>
  );
}
