// @ts-nocheck
import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { apiRequest } from "@/lib/queryClient";

interface ExpiringCertification {
  id: string;
  crewId: string;
  cert: string;
  certNumber?: string;
  issuedAt?: string;
  expiresAt: string;
  issuedBy?: string;
  alertSent?: boolean;
  alertAcknowledged?: boolean;
  alertAcknowledgedAt?: string;
  alertAcknowledgedBy?: string;
  alertAcknowledgedNotes?: string;
  crewMemberName: string;
  crewMemberRank: string;
  daysUntilExpiry: number;
  urgencyLevel: "critical" | "warning" | "notice";
}

interface ExpiryAlertsSummary {
  total: number;
  critical: number;
  warning: number;
  notice: number;
}

interface ExpiringCertsResponse {
  certifications: ExpiringCertification[];
  summary: ExpiryAlertsSummary;
}

export interface UseCertificationExpiryDataProps {
  daysAhead?: number;
}

export interface UseCertificationExpiryDataReturn {
  data: ExpiringCertsResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  acknowledgeDialogOpen: boolean;
  setAcknowledgeDialogOpen: (open: boolean) => void;
  selectedCert: ExpiringCertification | null;
  setSelectedCert: (cert: ExpiringCertification | null) => void;
  acknowledgeNotes: string;
  setAcknowledgeNotes: (notes: string) => void;
  handleAcknowledge: (cert: ExpiringCertification) => void;
  confirmAcknowledge: () => void;
  markRenewed: (cert: ExpiringCertification) => void;
  isAcknowledging: boolean;
  unacknowledgedCerts: ExpiringCertification[];
  criticalCount: number;
  warningCount: number;
}

export function useCertificationExpiryData({
  daysAhead = 90,
}: UseCertificationExpiryDataProps = {}): UseCertificationExpiryDataReturn {
  const { currentOrgId: orgId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isExpanded, setIsExpanded] = useState(false);
  const [acknowledgeDialogOpen, setAcknowledgeDialogOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState<ExpiringCertification | null>(null);
  const [acknowledgeNotes, setAcknowledgeNotes] = useState("");

  const { data, isLoading, error } = useQuery<ExpiringCertsResponse>({
    queryKey: ["/api/crew-certifications/expiring", { daysAhead }],
    enabled: !!orgId,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ certId, notes }: { certId: string; notes?: string }) => {
      return apiRequest(`/api/crew-certifications/${certId}/acknowledge-alert`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew-certifications/expiring"] });
      toast({
        title: "Alert Acknowledged",
        description: "The certification expiry alert has been acknowledged.",
      });
      setAcknowledgeDialogOpen(false);
      setSelectedCert(null);
      setAcknowledgeNotes("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to acknowledge alert",
        variant: "destructive",
      });
    },
  });

  const handleAcknowledge = useCallback((cert: ExpiringCertification) => {
    setSelectedCert(cert);
    setAcknowledgeDialogOpen(true);
  }, []);

  const confirmAcknowledge = useCallback(() => {
    if (selectedCert) {
      acknowledgeMutation.mutate({ certId: selectedCert.id, notes: acknowledgeNotes || undefined });
    }
  }, [selectedCert, acknowledgeNotes, acknowledgeMutation]);

  const markRenewed = useCallback(
    (cert: ExpiringCertification) => {
      acknowledgeMutation.mutate({
        certId: cert.id,
        notes: `Renewed — ${cert.certificationName || "certification"}`,
      });
      toast({
        title: "Marked as Renewed",
        description: `${cert.certificationName || "Certification"} has been marked as renewed. Update the expiry date in your records.`,
      });
    },
    [acknowledgeMutation, toast]
  );

  const unacknowledgedCerts = useMemo(() => {
    return (data?.certifications ?? []).filter((c) => !c.alertAcknowledged);
  }, [data?.certifications]);

  const criticalCount = useMemo(() => {
    return unacknowledgedCerts.filter((c) => c.urgencyLevel === "critical").length;
  }, [unacknowledgedCerts]);

  const warningCount = useMemo(() => {
    return unacknowledgedCerts.filter((c) => c.urgencyLevel === "warning").length;
  }, [unacknowledgedCerts]);

  return {
    data,
    isLoading,
    error,
    isExpanded,
    setIsExpanded,
    acknowledgeDialogOpen,
    setAcknowledgeDialogOpen,
    selectedCert,
    setSelectedCert,
    acknowledgeNotes,
    setAcknowledgeNotes,
    handleAcknowledge,
    confirmAcknowledge,
    markRenewed,
    isAcknowledging: acknowledgeMutation.isPending,
    unacknowledgedCerts,
    criticalCount,
    warningCount,
  };
}

export type { ExpiringCertification, ExpiryAlertsSummary, ExpiringCertsResponse };
