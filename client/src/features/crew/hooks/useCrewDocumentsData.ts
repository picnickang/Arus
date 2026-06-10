import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { apiRequest, createHeaders, resolveUrl } from "@/lib/queryClient";
import { format, differenceInDays } from "date-fns";
import { useCreateCrewTask } from "./useCrewTasks";
import { normRoleKey } from "../lib/crewManagementUtils";
import type { CrewTaskView } from "../lib/crewTaskUtils";
import { decideRenewalTask } from "../lib/crewTaskUtils";
import { CREW_DOCUMENT_TYPE_VALUES } from "@shared/schema";
import type { CrewRole } from "@shared/schema";

// Default renewal-reminder lead time (days). The form lets the user pick a
// different lead time per document; a document within that window of expiry
// spawns a renewal task on save.
const DEFAULT_REMINDER_LEAD_DAYS = 90;

export interface CrewDocument {
  id: string;
  orgId: string;
  crewId: string;
  documentType: string;
  documentNumber?: string;
  filePath?: string | null;
  issuedAt?: string;
  expiresAt?: string;
  issuingAuthority?: string;
  issuingCountry?: string;
  notes?: string;
  alertSent?: boolean;
  alertAcknowledged?: boolean;
  alertAcknowledgedAt?: string;
  alertAcknowledgedBy?: string;
  alertAcknowledgedNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const DOCUMENT_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "seaman_book", label: "Seaman's Book" },
  { value: "visa", label: "Visa" },
  { value: "medical", label: "Medical Certificate" },
  { value: "endorsement", label: "Endorsement" },
] as const;

export const COMMON_COUNTRIES = [
  "Singapore",
  "Philippines",
  "Indonesia",
  "India",
  "China",
  "Myanmar",
  "Malaysia",
  "Vietnam",
  "Bangladesh",
  "Ukraine",
  "Russia",
  "Panama",
  "Liberia",
  "Marshall Islands",
  "Hong Kong",
  "Japan",
  "South Korea",
  "United States",
  "United Kingdom",
  "Norway",
  "Greece",
];

export const documentFormSchema = z.object({
  // "new" vs "renewal" only affects messaging + the renewal-task copy; both
  // paths persist the same document record (extra keys are stripped server-side).
  action: z.enum(["new", "renewal"]).default("new"),
  documentType: z.enum(CREW_DOCUMENT_TYPE_VALUES),
  documentNumber: z.string().min(1, "Document number is required"),
  issuedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  issuingAuthority: z.string().optional(),
  issuingCountry: z.string().optional(),
  notes: z.string().optional(),
  // How many days before expiry to raise a renewal reminder task.
  reminderLeadDays: z.coerce.number().int().min(1).max(365).default(DEFAULT_REMINDER_LEAD_DAYS),
});

export type DocumentFormData = z.infer<typeof documentFormSchema>;

export function useCrewDocumentsData(crewId: string) {
  const { currentOrgId: orgId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<CrewDocument | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const createTaskMutation = useCreateCrewTask();

  // When a saved/renewed document is at/near expiry, raise a linked renewal task
  // (existing crew-task mechanism — no new backend). Skips if an open renewal
  // task already exists for the document so re-saving never spawns duplicates.
  const raiseRenewalTask = useCallback(
    async (
      doc: { id: string; documentType: string; documentNumber?: string; expiresAt?: string },
      leadDays: number = DEFAULT_REMINDER_LEAD_DAYS,
    ) => {
      if (!doc.expiresAt) {
        return;
      }
      let openTasks: CrewTaskView[] = [];
      try {
        openTasks =
          (await apiRequest<CrewTaskView[]>(
            `/api/crew-tasks?assignedCrewId=${encodeURIComponent(crewId)}`
          )) ?? [];
      } catch {
        // If the lookup fails, fall through with no known open tasks — a
        // possible duplicate is better than silently dropping a reminder.
        openTasks = [];
      }
      const decision = decideRenewalTask({
        docId: doc.id,
        expiresAt: doc.expiresAt,
        leadDays,
        openTasks,
      });
      if (!decision.shouldRaise) {
        return;
      }
      const label = DOCUMENT_TYPES.find((d) => d.value === doc.documentType)?.label ?? doc.documentType;
      const when = format(new Date(doc.expiresAt), "MMM d, yyyy");
      createTaskMutation.mutate({
        title: `Renew ${label}`,
        description:
          decision.daysUntilExpiry <= 0
            ? `${label}${doc.documentNumber ? ` (${doc.documentNumber})` : ""} expired ${when}. Submit renewal.`
            : `${label}${doc.documentNumber ? ` (${doc.documentNumber})` : ""} expires ${when}. Submit renewal.`,
        assignedCrewId: crewId,
        priority: decision.priority,
        dueDate: new Date(doc.expiresAt).toISOString(),
        linkedSourceType: "crew_document",
        linkedSourceId: doc.id,
        linkedSourceLabel: label,
      });
    },
    [createTaskMutation, crewId]
  );

  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<DocumentFormData, unknown, DocumentFormData>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      action: "new",
      documentType: "passport",
      documentNumber: "",
      issuedAt: "",
      expiresAt: "",
      issuingAuthority: "",
      issuingCountry: "",
      notes: "",
      reminderLeadDays: DEFAULT_REMINDER_LEAD_DAYS,
    },
  });

  // Upload a staged scan to the document's file endpoint (multipart). Uses the
  // shared auth headers; apiRequest can't carry FormData, so this hits fetch
  // directly the same way the crew-photo upload does.
  const uploadDocFile = useCallback(
    async (docId: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(resolveUrl(`/api/crew/${crewId}/documents/${docId}/file`), {
        method: "POST",
        headers: createHeaders(false),
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: unknown; message?: string } | null;
        throw new Error(payload?.message || (typeof payload?.error === "string" ? payload.error : undefined) || `File upload failed (${res.status}).`);
      }
    },
    [crewId]
  );

  const { data: documents, isLoading } = useQuery<CrewDocument[]>({
    queryKey: ["/api/crew", crewId, "documents"],
    enabled: !!crewId && !!orgId,
  });

  // Thin mutations — orchestration (file upload, renewal task, toast, close)
  // happens in onSubmit so a staged scan can be uploaded after the row exists.
  const createMutation = useMutation({
    mutationFn: async (data: DocumentFormData) =>
      apiRequest<CrewDocument>(`/api/crew/${crewId}/documents`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DocumentFormData }) =>
      apiRequest<CrewDocument>(`/api/crew-documents/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/crew-documents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew", crewId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crew-documents/expiring"] });
      toast({ title: "Document Deleted", description: "The crew document has been deleted." });
      setIsDeleteDialogOpen(false);
      setSelectedDoc(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  const handleOpenAddForm = useCallback(() => {
    setIsEditing(false);
    setSelectedDoc(null);
    setStagedFile(null);
    setUploadError(null);
    form.reset({
      action: "new",
      documentType: "passport",
      documentNumber: "",
      issuedAt: "",
      expiresAt: "",
      issuingAuthority: "",
      issuingCountry: "",
      notes: "",
      reminderLeadDays: DEFAULT_REMINDER_LEAD_DAYS,
    });
    setIsFormOpen(true);
  }, [form]);

  const handleOpenEditForm = useCallback(
    (doc: CrewDocument) => {
      setIsEditing(true);
      setSelectedDoc(doc);
      setStagedFile(null);
      setUploadError(null);
      form.reset({
        // Editing an existing document defaults to a "renewal" action.
        action: "renewal",
        documentType: doc.documentType as DocumentFormData["documentType"],
        documentNumber: doc.documentNumber || "",
        issuedAt: doc.issuedAt ? format(new Date(doc.issuedAt), "yyyy-MM-dd") : "",
        expiresAt: doc.expiresAt ? format(new Date(doc.expiresAt), "yyyy-MM-dd") : "",
        issuingAuthority: doc.issuingAuthority || "",
        issuingCountry: doc.issuingCountry || "",
        notes: doc.notes || "",
        reminderLeadDays: DEFAULT_REMINDER_LEAD_DAYS,
      });
      setIsFormOpen(true);
    },
    [form]
  );

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setIsEditing(false);
    setSelectedDoc(null);
    setStagedFile(null);
    setUploadError(null);
    form.reset();
  }, [form]);

  const handleOpenDeleteDialog = useCallback((doc: CrewDocument) => {
    setSelectedDoc(doc);
    setIsDeleteDialogOpen(true);
  }, []);

  // Orchestrated save: persist the document row, optionally upload the staged
  // scan (when uploadFile), refresh caches, raise a renewal task within the
  // chosen lead time, then close. "Save draft" passes uploadFile=false so the
  // metadata can be saved now and a scan attached later.
  const onSubmit = useCallback(
    async (data: DocumentFormData, uploadFile: boolean = true) => {
      setUploadError(null);
      setIsSaving(true);
      let doc: CrewDocument | undefined;
      try {
        doc =
          isEditing && selectedDoc
            ? await updateMutation.mutateAsync({ id: selectedDoc.id, data })
            : await createMutation.mutateAsync(data);
      } catch (error) {
        setIsSaving(false);
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to save document",
          variant: "destructive",
        });
        return;
      }

      if (uploadFile && stagedFile && doc?.id) {
        try {
          await uploadDocFile(doc.id, stagedFile);
        } catch (error) {
          setIsSaving(false);
          queryClient.invalidateQueries({ queryKey: ["/api/crew", crewId, "documents"] });
          setUploadError(
            error instanceof Error ? error.message : "File upload failed."
          );
          return;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/crew", crewId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crew-documents/expiring"] });
      if (doc?.id) {
        void raiseRenewalTask(doc, data.reminderLeadDays);
      }
      toast({
        title: isEditing ? "Document Updated" : "Document Added",
        description:
          data.action === "renewal"
            ? "The crew document renewal has been saved."
            : "The crew document has been saved.",
      });
      setIsSaving(false);
      handleCloseForm();
    },
    [
      isEditing,
      selectedDoc,
      updateMutation,
      createMutation,
      stagedFile,
      uploadDocFile,
      raiseRenewalTask,
      crewId,
      toast,
      handleCloseForm,
    ]
  );

  const getDocumentTypeLabel = useCallback(
    (type: string) => DOCUMENT_TYPES.find((d) => d.value === type)?.label || type,
    []
  );

  const getExpiryStatus = useCallback((expiresAt?: string) => {
    if (!expiresAt) {
      return null;
    }
    const daysUntilExpiry = differenceInDays(new Date(expiresAt), new Date());
    if (daysUntilExpiry <= 0) {
      return {
        level: "expired",
        label: "Expired",
        className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      };
    }
    if (daysUntilExpiry <= 30) {
      return {
        level: "critical",
        label: `${daysUntilExpiry}d`,
        className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      };
    }
    if (daysUntilExpiry <= 60) {
      return {
        level: "warning",
        label: `${daysUntilExpiry}d`,
        className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      };
    }
    if (daysUntilExpiry <= 90) {
      return {
        level: "notice",
        label: `${daysUntilExpiry}d`,
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      };
    }
    return {
      level: "ok",
      label: "Valid",
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };
  }, []);

  return {
    documents: documents ?? [],
    isLoading,
    form,
    isFormOpen,
    setIsFormOpen,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    selectedDoc,
    isEditing,
    createMutation,
    updateMutation,
    deleteMutation,
    handleOpenAddForm,
    handleOpenEditForm,
    handleCloseForm,
    handleOpenDeleteDialog,
    onSubmit,
    stagedFile,
    setStagedFile,
    uploadError,
    isSaving,
    getDocumentTypeLabel,
    getExpiryStatus,
  };
}

/**
 * Returns the document types a crew member's role requires, matched by rank
 * (crew.rank === crewRole.name). Returns an empty array when the rank is unknown
 * or the role declares no requirements — callers treat empty as "no required-doc
 * view", so the compliance surfaces fall back to their default behaviour.
 */
export function useRoleRequiredDocuments(rank?: string | null): string[] {
  const { data: roles = [] } = useQuery<CrewRole[]>({
    queryKey: ["/api/crew-roles"],
  });
  if (!rank) {
    return [];
  }
  // Crew ranks are stored inconsistently (slug "first_officer", mixed-case
  // "Chief Engineer", lowercase "captain"). Normalize both sides to the same
  // role key so a rank matches its role regardless of how it was stored.
  const wantKey = normRoleKey(rank);
  const role = roles.find((r) => normRoleKey(r.name) === wantKey);
  return role?.requiredDocuments ?? [];
}
