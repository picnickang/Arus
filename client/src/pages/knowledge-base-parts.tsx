import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, Loader2, Search, Upload, X, XCircle } from "lucide-react";
import type { Document } from "@/features/ml-ai";

export type DocumentWithStatus = Document & { status?: string };

export interface UploadJob {
  id: string;
  file: File;
  status: "queued" | "uploading" | "processing" | "completed" | "failed";
  jobId?: string;
  progress: number;
  error?: string;
}

interface SemanticSearchResult {
  chunkId: string;
  docName: string;
  similarity: number;
  text?: string;
}

export interface SemanticSearchPayload {
  results?: SemanticSearchResult[];
}

export function UploadDropZone({
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

  if (!isOpen) {
    return null;
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf" || f.type.startsWith("image/")
    );
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  return (
    <div
      className="border rounded-lg p-4 bg-card mb-4 animate-in fade-in-50 duration-200"
      data-testid="upload-dropzone"
    >
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
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            fileInputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
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
            if (files.length > 0) {
              onFilesSelected(files);
            }
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }}
          className="hidden"
          data-testid="input-file"
        />
      </div>
    </div>
  );
}

export function UploadProgressBar({ jobs, onClear }: { jobs: UploadJob[]; onClear: () => void }) {
  if (jobs.length === 0) {
    return null;
  }

  const active = jobs.filter((j) => j.status === "uploading" || j.status === "processing").length;
  const completed = jobs.filter((j) => j.status === "completed").length;
  const failed = jobs.filter((j) => j.status === "failed").length;

  const statusIcon = (status: UploadJob["status"]) => {
    switch (status) {
      case "queued":
        return <Clock className="h-3 w-3 text-muted-foreground" />;
      case "uploading":
      case "processing":
        return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case "failed":
        return <XCircle className="h-3 w-3 text-destructive" />;
    }
  };

  return (
    <div className="border rounded-lg p-3 mb-4 bg-card" data-testid="upload-progress">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">
          {active > 0
            ? `Processing ${active} of ${jobs.length}`
            : `${completed} completed${failed > 0 ? `, ${failed} failed` : ""}`}
        </span>
        {active === 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-6 text-xs"
            data-testid="button-clear-uploads"
          >
            Clear
          </Button>
        )}
      </div>
      <div className="space-y-1">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center gap-2 text-xs"
            data-testid={`upload-job-${job.id}`}
          >
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

export function DocumentFilterBar({
  search,
  onSearchChange,
  fileType,
  onFileTypeChange,
  status,
  onStatusChange,
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

export function SemanticSearchResults({
  query,
  searchData,
  searching,
}: {
  query: string;
  searchData: SemanticSearchPayload | undefined;
  searching: boolean;
}) {
  const isQuestion = query.length >= 10 && (query.includes("?") || query.split(/\s+/).length > 4);
  if (!isQuestion || (!searching && !searchData?.results?.length)) {
    return null;
  }

  return (
    <div className="mb-4 border rounded-lg overflow-hidden" data-testid="semantic-results">
      <div className="px-4 py-2 bg-sky-500/5 border-b flex items-center gap-2">
        <Search className="h-3.5 w-3.5 text-sky-500" />
        <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
          AI Search Results
        </span>
        {searching && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
      {(searchData?.results?.length ?? 0) > 0 && (
        <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
          {searchData!.results!.slice(0, 5).map((result) => (
            <div
              key={result.chunkId}
              className="p-3 rounded border-l-2 border-sky-500 bg-card text-sm"
              data-testid={`search-result-${result.chunkId}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-xs">{result.docName}</span>
                <Badge variant="outline" className="text-[9px]">
                  {(result.similarity * 100).toFixed(0)}% match
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {result.text?.slice(0, 200)}
                {(result.text?.length ?? 0) > 200 ? "..." : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
