import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface Document { id: string; name: string; fileType: string; numChunks: number; createdAt: string; metadata?: Record<string, unknown>; }
interface SearchResult { chunkId: string; docId: string; docName: string; text: string; similarity: number; distance: number; ord: number; }
interface KBStats { totalDocuments: number; totalChunks: number; }

export function useKnowledgeBase() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stats } = useQuery<KBStats>({ queryKey: ["/api/kb/stats"] });
  const { data: documentsData, isLoading: documentsLoading } = useQuery<{ documents: Document[]; count: number }>({ queryKey: ["/api/kb/documents"] });
  const { data: searchData, isLoading: searching } = useQuery<{ query: string; results: SearchResult[]; count: number }>({ queryKey: ["/api/kb/search", searchQuery], enabled: searchQuery.length >= 3, queryFn: async () => { const params = new URLSearchParams({ q: searchQuery, limit: "10", threshold: "0.5" }); const res = await fetch(`/api/kb/search?${params}`); if (!res.ok) {throw new Error("Search failed");} return res.json(); } });

  const handleUploadComplete = useCallback(() => { queryClient.invalidateQueries({ queryKey: ["/api/kb/documents"] }); queryClient.invalidateQueries({ queryKey: ["/api/kb/stats"] }); }, []);

  const deleteMutation = useMutation({ mutationFn: async (docId: string) => apiRequest(`/kb/documents/${docId}`, { method: "DELETE" }), onSuccess: () => { toast({ title: "Document deleted", description: "The document has been removed from the knowledge base." }); queryClient.invalidateQueries({ queryKey: ["/api/kb/documents"] }); queryClient.invalidateQueries({ queryKey: ["/api/kb/stats"] }); }, onError: (error: Error) => { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); } });

  const handleDelete = useCallback((docId: string, docName: string) => { if (confirm(`Delete "${docName}"?`)) {deleteMutation.mutate(docId);} }, [deleteMutation]);

  return { stats, documentsData, documentsLoading, searchQuery, setSearchQuery, searchData, searching, handleUploadComplete, handleDelete, deleteMutation };
}

export type { Document, SearchResult, KBStats };
