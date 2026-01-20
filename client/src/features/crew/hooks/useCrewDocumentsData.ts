import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { apiRequest } from "@/lib/queryClient";
import { format, differenceInDays } from "date-fns";

export interface CrewDocument {
  id: string; orgId: string; crewId: string; documentType: string; documentNumber?: string; issuedAt?: string; expiresAt?: string; issuingAuthority?: string; issuingCountry?: string; notes?: string; alertSent?: boolean; alertAcknowledged?: boolean; alertAcknowledgedAt?: string; alertAcknowledgedBy?: string; alertAcknowledgedNotes?: string; createdAt?: string; updatedAt?: string;
}

export const DOCUMENT_TYPES = [{ value: "passport", label: "Passport" }, { value: "seaman_book", label: "Seaman's Book" }, { value: "visa", label: "Visa" }, { value: "medical", label: "Medical Certificate" }, { value: "endorsement", label: "Endorsement" }] as const;

export const COMMON_COUNTRIES = ["Singapore", "Philippines", "Indonesia", "India", "China", "Myanmar", "Malaysia", "Vietnam", "Bangladesh", "Ukraine", "Russia", "Panama", "Liberia", "Marshall Islands", "Hong Kong", "Japan", "South Korea", "United States", "United Kingdom", "Norway", "Greece"];

export const documentFormSchema = z.object({
  documentType: z.enum(["passport", "seaman_book", "visa", "medical", "endorsement"]),
  documentNumber: z.string().min(1, "Document number is required"),
  issuedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  issuingAuthority: z.string().optional(),
  issuingCountry: z.string().optional(),
  notes: z.string().optional(),
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

  const form = useForm<DocumentFormData>({ resolver: zodResolver(documentFormSchema), defaultValues: { documentType: "passport", documentNumber: "", issuedAt: "", expiresAt: "", issuingAuthority: "", issuingCountry: "", notes: "" } });

  const { data: documents, isLoading } = useQuery<CrewDocument[]>({ queryKey: ["/api/crew", crewId, "documents"], enabled: !!crewId && !!orgId });

  const createMutation = useMutation({
    mutationFn: async (data: DocumentFormData) => apiRequest(`/api/crew/${crewId}/documents`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crew", crewId, "documents"] }); queryClient.invalidateQueries({ queryKey: ["/api/crew-documents/expiring"] }); toast({ title: "Document Added", description: "The crew document has been added successfully." }); handleCloseForm(); },
    onError: (error: Error) => { toast({ title: "Error", description: error.message || "Failed to add document", variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DocumentFormData }) => apiRequest(`/api/crew-documents/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crew", crewId, "documents"] }); queryClient.invalidateQueries({ queryKey: ["/api/crew-documents/expiring"] }); toast({ title: "Document Updated", description: "The crew document has been updated successfully." }); handleCloseForm(); },
    onError: (error: Error) => { toast({ title: "Error", description: error.message || "Failed to update document", variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/crew-documents/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crew", crewId, "documents"] }); queryClient.invalidateQueries({ queryKey: ["/api/crew-documents/expiring"] }); toast({ title: "Document Deleted", description: "The crew document has been deleted." }); setIsDeleteDialogOpen(false); setSelectedDoc(null); },
    onError: (error: Error) => { toast({ title: "Error", description: error.message || "Failed to delete document", variant: "destructive" }); },
  });

  const handleOpenAddForm = useCallback(() => { setIsEditing(false); setSelectedDoc(null); form.reset({ documentType: "passport", documentNumber: "", issuedAt: "", expiresAt: "", issuingAuthority: "", issuingCountry: "", notes: "" }); setIsFormOpen(true); }, [form]);

  const handleOpenEditForm = useCallback((doc: CrewDocument) => { setIsEditing(true); setSelectedDoc(doc); form.reset({ documentType: doc.documentType as DocumentFormData["documentType"], documentNumber: doc.documentNumber || "", issuedAt: doc.issuedAt ? format(new Date(doc.issuedAt), "yyyy-MM-dd") : "", expiresAt: doc.expiresAt ? format(new Date(doc.expiresAt), "yyyy-MM-dd") : "", issuingAuthority: doc.issuingAuthority || "", issuingCountry: doc.issuingCountry || "", notes: doc.notes || "" }); setIsFormOpen(true); }, [form]);

  const handleCloseForm = useCallback(() => { setIsFormOpen(false); setIsEditing(false); setSelectedDoc(null); form.reset(); }, [form]);

  const handleOpenDeleteDialog = useCallback((doc: CrewDocument) => { setSelectedDoc(doc); setIsDeleteDialogOpen(true); }, []);

  const onSubmit = useCallback((data: DocumentFormData) => { if (isEditing && selectedDoc) {updateMutation.mutate({ id: selectedDoc.id, data });} else {createMutation.mutate(data);} }, [isEditing, selectedDoc, updateMutation, createMutation]);

  const getDocumentTypeLabel = useCallback((type: string) => DOCUMENT_TYPES.find((d) => d.value === type)?.label || type, []);

  const getExpiryStatus = useCallback((expiresAt?: string) => {
    if (!expiresAt) {return null;}
    const daysUntilExpiry = differenceInDays(new Date(expiresAt), new Date());
    if (daysUntilExpiry <= 0) {return { level: "expired", label: "Expired", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" };}
    if (daysUntilExpiry <= 30) {return { level: "critical", label: `${daysUntilExpiry}d`, className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" };}
    if (daysUntilExpiry <= 60) {return { level: "warning", label: `${daysUntilExpiry}d`, className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" };}
    if (daysUntilExpiry <= 90) {return { level: "notice", label: `${daysUntilExpiry}d`, className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" };}
    return { level: "ok", label: "Valid", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" };
  }, []);

  return { documents: documents ?? [], isLoading, form, isFormOpen, setIsFormOpen, isDeleteDialogOpen, setIsDeleteDialogOpen, selectedDoc, isEditing, createMutation, updateMutation, deleteMutation, handleOpenAddForm, handleOpenEditForm, handleCloseForm, handleOpenDeleteDialog, onSubmit, getDocumentTypeLabel, getExpiryStatus };
}
