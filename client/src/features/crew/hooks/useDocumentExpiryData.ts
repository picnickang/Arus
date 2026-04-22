import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { apiRequest } from "@/lib/queryClient";

interface ExpiringDocument {
  id: string;
  crewId: string;
  documentType: string;
  documentNumber?: string;
  issuedAt?: string;
  expiresAt: string;
  issuingAuthority?: string;
  issuingCountry?: string;
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

interface ExpiringDocsResponse {
  documents: ExpiringDocument[];
  summary: ExpiryAlertsSummary;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  passport: "Passport",
  seaman_book: "Seaman's Book",
  visa: "Visa",
  medical: "Medical Certificate",
  endorsement: "Endorsement",
};

export interface UseDocumentExpiryDataProps {
  daysAhead?: number;
}

export interface UseDocumentExpiryDataReturn {
  data: ExpiringDocsResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  acknowledgeDialogOpen: boolean;
  setAcknowledgeDialogOpen: (open: boolean) => void;
  selectedDoc: ExpiringDocument | null;
  setSelectedDoc: (doc: ExpiringDocument | null) => void;
  acknowledgeNotes: string;
  setAcknowledgeNotes: (notes: string) => void;
  handleAcknowledge: (doc: ExpiringDocument) => void;
  confirmAcknowledge: () => void;
  markRenewed: (doc: ExpiringDocument) => void;
  isAcknowledging: boolean;
  unacknowledgedDocs: ExpiringDocument[];
  criticalCount: number;
  warningCount: number;
  getDocumentTypeLabel: (type: string) => string;
}

export function useDocumentExpiryData({
  daysAhead = 90,
}: UseDocumentExpiryDataProps = {}): UseDocumentExpiryDataReturn {
  const { currentOrgId: orgId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isExpanded, setIsExpanded] = useState(false);
  const [acknowledgeDialogOpen, setAcknowledgeDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ExpiringDocument | null>(null);
  const [acknowledgeNotes, setAcknowledgeNotes] = useState("");

  const { data, isLoading, error } = useQuery<ExpiringDocsResponse>({
    queryKey: ["/api/crew-documents/expiring", { daysAhead }],
    enabled: !!orgId,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ docId, notes }: { docId: string; notes?: string }) => {
      return apiRequest(`/api/crew-documents/${docId}/acknowledge-alert`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew-documents/expiring"] });
      toast({
        title: "Alert Acknowledged",
        description: "The document expiry alert has been acknowledged.",
      });
      setAcknowledgeDialogOpen(false);
      setSelectedDoc(null);
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

  const handleAcknowledge = useCallback((doc: ExpiringDocument) => {
    setSelectedDoc(doc);
    setAcknowledgeDialogOpen(true);
  }, []);

  const confirmAcknowledge = useCallback(() => {
    if (selectedDoc) {
      acknowledgeMutation.mutate({ docId: selectedDoc.id, notes: acknowledgeNotes || undefined });
    }
  }, [selectedDoc, acknowledgeNotes, acknowledgeMutation]);

  const markRenewed = useCallback(
    (doc: ExpiringDocument) => {
      acknowledgeMutation.mutate({
        docId: doc.id,
        notes: `Renewed — ${doc.documentType || "document"}`,
      });
      toast({
        title: "Marked as Renewed",
        description: `${doc.documentType || "Document"} has been marked as renewed. Update the expiry date in your records.`,
      });
    },
    [acknowledgeMutation, toast]
  );

  const unacknowledgedDocs = useMemo(() => {
    return (data?.documents ?? []).filter((d) => !d.alertAcknowledged);
  }, [data?.documents]);

  const criticalCount = useMemo(() => {
    return unacknowledgedDocs.filter((d) => d.urgencyLevel === "critical").length;
  }, [unacknowledgedDocs]);

  const warningCount = useMemo(() => {
    return unacknowledgedDocs.filter((d) => d.urgencyLevel === "warning").length;
  }, [unacknowledgedDocs]);

  const getDocumentTypeLabel = useCallback((type: string) => {
    return DOCUMENT_TYPE_LABELS[type] || type;
  }, []);

  return {
    data,
    isLoading,
    error,
    isExpanded,
    setIsExpanded,
    acknowledgeDialogOpen,
    setAcknowledgeDialogOpen,
    selectedDoc,
    setSelectedDoc,
    acknowledgeNotes,
    setAcknowledgeNotes,
    handleAcknowledge,
    confirmAcknowledge,
    markRenewed,
    isAcknowledging: acknowledgeMutation.isPending,
    unacknowledgedDocs,
    criticalCount,
    warningCount,
    getDocumentTypeLabel,
  };
}

export type { ExpiringDocument, ExpiryAlertsSummary, ExpiringDocsResponse };
