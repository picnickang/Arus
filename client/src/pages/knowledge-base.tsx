import { ApiError } from "@/lib/api-error";
import { apiFormDataRequest, apiRequest } from "@/lib/queryClient";
import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Loader2, Trash2 } from "lucide-react";
import { useKnowledgeBase, type Document } from "@/features/ml-ai";
import {
  DocumentFilterBar,
  SemanticSearchResults,
  UploadDropZone,
  UploadProgressBar,
  type DocumentWithStatus,
  type UploadJob,
} from "./knowledge-base-parts";

export default function KnowledgeBasePage() {
  const { toast } = useToast();
  const {
    stats,
    documentsData,
    documentsLoading,
    searchQuery,
    setSearchQuery,
    searchData,
    searching,
    handleUploadComplete,
    handleDelete,
    deleteMutation,
  } = useKnowledgeBase();

  const [showUpload, setShowUpload] = useState(false);
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [docSearch, setDocSearch] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const handleSearchChange = useCallback(
    (value: string) => {
      setDocSearch(value);
      if (value.length >= 10 && (value.includes("?") || value.split(/\s+/).length > 4)) {
        setSearchQuery(value);
      } else if (value.length < 3) {
        setSearchQuery("");
      }
    },
    [setSearchQuery]
  );

  const filteredDocuments = useMemo(() => {
    if (!documentsData?.documents) {
      return [];
    }
    return documentsData.documents.filter((doc: DocumentWithStatus) => {
      const matchesSearch = !docSearch || doc.name.toLowerCase().includes(docSearch.toLowerCase());
      const matchesType = fileTypeFilter === "all" || doc.fileType === fileTypeFilter;
      const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [documentsData?.documents, docSearch, fileTypeFilter, statusFilter]);

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      const MAX_SIZE = 10 * 1024 * 1024;
      const oversized = files.filter((f) => f.size > MAX_SIZE);
      if (oversized.length > 0) {
        toast({
          title: "Files too large",
          description: `${oversized.map((f) => f.name).join(", ")} exceed the 10MB limit.`,
          variant: "destructive",
        });
      }
      const valid = files.filter((f) => f.size <= MAX_SIZE);
      if (valid.length === 0) {
        return;
      }

      const newJobs: UploadJob[] = valid.map((file) => ({
        id: crypto.randomUUID().slice(0, 8),
        file,
        status: "queued",
        progress: 0,
      }));
      setUploadJobs((prev) => [...prev, ...newJobs]);
      newJobs.forEach((job) => uploadFile(job));
    },
    [toast]
  );

  const uploadFile = async (job: UploadJob) => {
    setUploadJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, status: "uploading" as const, progress: 10 } : j))
    );
    try {
      const formData = new FormData();
      formData.append("file", job.file);
      const data = await apiFormDataRequest<{ jobId: string }>("POST", "/api/kb/upload", formData);
      setUploadJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? { ...j, status: "processing" as const, jobId: data.jobId, progress: 30 }
            : j
        )
      );
      pollJobStatus(job.id, data.jobId);
    } catch (error) {
      setUploadJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? {
                ...j,
                status: "failed" as const,
                error: error instanceof Error ? error.message : "Upload failed",
              }
            : j
        )
      );
    }
  };

  const pollJobStatus = async (uploadId: string, jobId: string) => {
    let polling = true;
    let backoffMs = 1000;
    while (polling) {
      try {
        let status: { status?: string; error?: string };
        try {
          status = await apiRequest<{ status?: string; error?: string }>(
            "GET",
            `/api/kb/jobs/${jobId}`
          );
        } catch (error) {
          // HTTP errors stop polling (the old !res.ok break); network blips
          // fall through to the outer retry.
          if (error instanceof ApiError) {
            break;
          }
          throw error;
        }
        if (status.status === "completed") {
          setUploadJobs((prev) =>
            prev.map((j) =>
              j.id === uploadId ? { ...j, status: "completed" as const, progress: 100 } : j
            )
          );
          handleUploadComplete();
          polling = false;
        } else if (status.status === "failed") {
          setUploadJobs((prev) =>
            prev.map((j) =>
              j.id === uploadId
                ? { ...j, status: "failed" as const, error: status.error || "Processing failed" }
                : j
            )
          );
          polling = false;
        } else {
          setUploadJobs((prev) =>
            prev.map((j) =>
              j.id === uploadId ? { ...j, progress: status.status === "processing" ? 60 : 40 } : j
            )
          );
        }
        if (polling) {
          await new Promise((r) => setTimeout(r, backoffMs));
          backoffMs = Math.min(backoffMs * 1.5, 5000);
        }
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  };

  return (
    <div className="min-h-screen" data-testid="page-knowledge-base">
      <div className="px-4 md:px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage fleet knowledge base
            {stats && (
              <span className="ml-2">
                · {stats.totalDocuments} documents · {stats.totalChunks} chunks
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={() => setShowUpload(!showUpload)}
          variant={showUpload ? "secondary" : "default"}
          data-testid="button-toggle-upload"
        >
          <Upload className="h-4 w-4 mr-2" />
          {showUpload ? "Close Upload" : "Upload"}
        </Button>
      </div>

      <div className="px-4 md:px-6 pb-6">
        <UploadDropZone
          isOpen={showUpload}
          onClose={() => setShowUpload(false)}
          onFilesSelected={handleFilesSelected}
        />

        <UploadProgressBar jobs={uploadJobs} onClear={() => setUploadJobs([])} />

        <DocumentFilterBar
          search={docSearch}
          onSearchChange={handleSearchChange}
          fileType={fileTypeFilter}
          onFileTypeChange={setFileTypeFilter}
          status={statusFilter}
          onStatusChange={setStatusFilter}
          onClear={() => {
            setDocSearch("");
            setFileTypeFilter("all");
            setStatusFilter("all");
            setSearchQuery("");
          }}
        />

        <SemanticSearchResults query={docSearch} searchData={searchData} searching={searching} />

        {documentsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filteredDocuments.length > 0 ? (
          <div className="space-y-1" data-testid="documents-list">
            {filteredDocuments.map((doc: Document) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                data-testid={`document-${doc.id}`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div
                      className="font-medium text-sm truncate"
                      data-testid={`text-name-${doc.id}`}
                    >
                      {doc.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {doc.fileType.toUpperCase()} · {doc.numChunks} chunks ·{" "}
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(doc.id, doc.name)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-${doc.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : documentsData?.documents?.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground" data-testid="empty-state">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No documents yet</p>
            <p className="text-sm mt-1">
              Upload PDF or image files to build your fleet knowledge base.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowUpload(true)}
              data-testid="button-upload-first"
            >
              <Upload className="h-4 w-4 mr-2" /> Upload First Document
            </Button>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No documents match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
