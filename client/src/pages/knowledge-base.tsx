import { useState, useCallback, useRef, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Search, FileText, Loader2, Trash2, X,
  CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { useKnowledgeBase, type Document } from "@/features/ml-ai";

type DocumentWithStatus = Document & { status?: string };

interface UploadJob {
  id: string;
  file: File;
  status: "queued" | "uploading" | "processing" | "completed" | "failed";
  jobId?: string;
  progress: number;
  error?: string;
}

function UploadDropZone({
  onFilesSelected,
  isOpen,
  onClose,
}: {
  onFilesSelected: (files: File[]) => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf" || f.type.startsWith("image/")
    );
    if (files.length > 0) onFilesSelected(files);
  };

  return (
    <div className="border rounded-lg p-4 bg-card mb-4 animate-in fade-in-50 duration-200" data-testid="upload-dropzone">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Upload className="h-4 w-4" /> Upload Documents
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-upload">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/20 hover:border-primary/40 hover:bg-accent/30"
        }`}
        data-testid="dropzone-area"
      >
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground/60" />
        <p className="text-sm font-medium">Drop files here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPEG — max 10MB per file</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,image/png,image/jpeg"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) onFilesSelected(files);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          className="hidden"
          data-testid="input-file"
        />
      </div>
    </div>
  );
}

function UploadProgressBar({ jobs, onClear }: { jobs: UploadJob[]; onClear: () => void }) {
  if (jobs.length === 0) return null;

  const active = jobs.filter((j) => j.status === "uploading" || j.status === "processing").length;
  const completed = jobs.filter((j) => j.status === "completed").length;
  const failed = jobs.filter((j) => j.status === "failed").length;

  const statusIcon = (status: UploadJob["status"]) => {
    switch (status) {
      case "queued": return <Clock className="h-3 w-3 text-muted-foreground" />;
      case "uploading":
      case "processing": return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
      case "completed": return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case "failed": return <XCircle className="h-3 w-3 text-destructive" />;
    }
  };

  return (
    <div className="border rounded-lg p-3 mb-4 bg-card" data-testid="upload-progress">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">
          {active > 0 ? `Processing ${active} of ${jobs.length}` : `${completed} completed${failed > 0 ? `, ${failed} failed` : ""}`}
        </span>
        {active === 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-6 text-xs" data-testid="button-clear-uploads">
            Clear
          </Button>
        )}
      </div>
      <div className="space-y-1">
        {jobs.map((job) => (
          <div key={job.id} className="flex items-center gap-2 text-xs" data-testid={`upload-job-${job.id}`}>
            {statusIcon(job.status)}
            <span className="truncate flex-1">{job.file.name}</span>
            {(job.status === "uploading" || job.status === "processing") && (
              <Progress value={job.progress} className="w-16 h-1" />
            )}
            {job.status === "failed" && (
              <span className="text-destructive truncate max-w-[120px]">{job.error}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentFilterBar({
  search, onSearchChange,
  fileType, onFileTypeChange,
  status, onStatusChange,
  onClear,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  fileType: string;
  onFileTypeChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  onClear: () => void;
}) {
  const hasFilters = search || fileType !== "all" || status !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          data-testid="input-doc-search"
        />
      </div>
      <select
        value={fileType}
        onChange={(e) => onFileTypeChange(e.target.value)}
        className="h-10 px-3 rounded-md border text-sm bg-background"
        data-testid="select-file-type"
      >
        <option value="all">All types</option>
        <option value="pdf">PDF</option>
        <option value="png">PNG</option>
        <option value="jpeg">JPEG</option>
      </select>
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="h-10 px-3 rounded-md border text-sm bg-background"
        data-testid="select-status"
      >
        <option value="all">All status</option>
        <option value="ready">Ready</option>
        <option value="processing">Processing</option>
        <option value="failed">Failed</option>
      </select>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} data-testid="button-clear-filters">
          <X className="h-3 w-3 mr-1" /> Clear
        </Button>
      )}
    </div>
  );
}

function SemanticSearchResults({ query, searchData, searching }: {
  query: string;
  searchData: any;
  searching: boolean;
}) {
  const isQuestion = query.length >= 10 && (query.includes("?") || query.split(/\s+/).length > 4);
  if (!isQuestion || (!searching && !searchData?.results?.length)) return null;

  return (
    <div className="mb-4 border rounded-lg overflow-hidden" data-testid="semantic-results">
      <div className="px-4 py-2 bg-sky-500/5 border-b flex items-center gap-2">
        <Search className="h-3.5 w-3.5 text-sky-500" />
        <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">AI Search Results</span>
        {searching && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
      {searchData?.results?.length > 0 && (
        <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
          {searchData.results.slice(0, 5).map((result: any) => (
            <div key={result.chunkId} className="p-3 rounded border-l-2 border-sky-500 bg-card text-sm" data-testid={`search-result-${result.chunkId}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-xs">{result.docName}</span>
                <Badge variant="outline" className="text-[9px]">
                  {(result.similarity * 100).toFixed(0)}% match
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{result.text?.slice(0, 200)}{result.text?.length > 200 ? "..." : ""}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

  const handleSearchChange = useCallback((value: string) => {
    setDocSearch(value);
    if (value.length >= 10 && (value.includes("?") || value.split(/\s+/).length > 4)) {
      setSearchQuery(value);
    } else if (value.length < 3) {
      setSearchQuery("");
    }
  }, [setSearchQuery]);

  const filteredDocuments = useMemo(() => {
    if (!documentsData?.documents) return [];
    return documentsData.documents.filter((doc: DocumentWithStatus) => {
      const matchesSearch = !docSearch || doc.name.toLowerCase().includes(docSearch.toLowerCase());
      const matchesType = fileTypeFilter === "all" || doc.fileType === fileTypeFilter;
      const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [documentsData?.documents, docSearch, fileTypeFilter, statusFilter]);

  const handleFilesSelected = useCallback((files: File[]) => {
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
    if (valid.length === 0) return;

    const newJobs: UploadJob[] = valid.map((file) => ({
      id: crypto.randomUUID().slice(0, 8),
      file,
      status: "queued",
      progress: 0,
    }));
    setUploadJobs((prev) => [...prev, ...newJobs]);
    newJobs.forEach((job) => uploadFile(job));
  }, [toast]);

  const uploadFile = async (job: UploadJob) => {
    setUploadJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: "uploading" as const, progress: 10 } : j));
    try {
      const formData = new FormData();
      formData.append("file", job.file);
      const res = await fetch("/api/kb/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Upload failed");
      }
      const data = await res.json();
      setUploadJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: "processing" as const, jobId: data.jobId, progress: 30 } : j));
      pollJobStatus(job.id, data.jobId);
    } catch (error) {
      setUploadJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: "failed" as const, error: error instanceof Error ? error.message : "Upload failed" } : j));
    }
  };

  const pollJobStatus = async (uploadId: string, jobId: string) => {
    let polling = true;
    let backoffMs = 1000;
    while (polling) {
      try {
        const res = await fetch(`/api/kb/jobs/${jobId}`);
        if (!res.ok) break;
        const status = await res.json();
        if (status.status === "completed") {
          setUploadJobs((prev) => prev.map((j) => j.id === uploadId ? { ...j, status: "completed" as const, progress: 100 } : j));
          handleUploadComplete();
          polling = false;
        } else if (status.status === "failed") {
          setUploadJobs((prev) => prev.map((j) => j.id === uploadId ? { ...j, status: "failed" as const, error: status.error || "Processing failed" } : j));
          polling = false;
        } else {
          setUploadJobs((prev) => prev.map((j) => j.id === uploadId ? { ...j, progress: status.status === "processing" ? 60 : 40 } : j));
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
        <Button onClick={() => setShowUpload(!showUpload)} variant={showUpload ? "secondary" : "default"} data-testid="button-toggle-upload">
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

        <UploadProgressBar
          jobs={uploadJobs}
          onClear={() => setUploadJobs([])}
        />

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

        <SemanticSearchResults
          query={docSearch}
          searchData={searchData}
          searching={searching}
        />

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
                    <div className="font-medium text-sm truncate" data-testid={`text-name-${doc.id}`}>
                      {doc.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {doc.fileType.toUpperCase()} · {doc.numChunks} chunks · {new Date(doc.createdAt).toLocaleDateString()}
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
            <p className="text-sm mt-1">Upload PDF or image files to build your fleet knowledge base.</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowUpload(true)} data-testid="button-upload-first">
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
