import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSearch, useLocation } from "wouter";
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { Upload, Search, FileText, Loader2, AlertCircle, Trash2, X, CheckCircle2, XCircle, Clock, MessageSquare, BookOpen } from 'lucide-react';
import { useKnowledgeBase, type Document } from "@/features/ml-ai";
type DocumentWithStatus = Document & { status?: string };
import { DocumentFilters, EmptyState, SupportedFormats } from "@/components/kb";
import { ChatInterface } from '@/components/rag';

interface UploadJob { id: string; file: File; status: 'queued' | 'uploading' | 'processing' | 'completed' | 'failed'; jobId?: string; progress: number; error?: string; }
interface JobStatus { id: string; status: 'pending' | 'processing' | 'completed' | 'failed'; progress?: number; error?: string; result?: Record<string, unknown>; }

function BatchUploadPanel({ onUploadComplete }: { onUploadComplete: () => void }) {
  const { toast } = useToast();
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingJobsRef = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => { return () => { pollingJobsRef.current.forEach(controller => controller.abort()); pollingJobsRef.current.clear(); }; }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'));
    if (files.length > 0) { addFiles(files); } else { toast({ title: 'Invalid files', description: 'Please upload PDF or image files only.', variant: 'destructive' }); }
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => { setIsDragging(false); }, []);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const files = Array.from(e.target.files ?? []); if (files.length > 0) { addFiles(files); } if (fileInputRef.current) { fileInputRef.current.value = ''; } };

  const addFiles = (files: File[]) => {
    const MAX_SIZE = 10 * 1024 * 1024;
    const oversizedFiles = files.filter(f => f.size > MAX_SIZE);
    if (oversizedFiles.length > 0) {
      toast({
        title: 'Files too large',
        description: `${oversizedFiles.map(f => f.name).join(', ')} exceed${oversizedFiles.length > 1 ? '' : 's'} the 10MB limit.`,
        variant: 'destructive',
      });
    }
    const validFiles = files.filter(f => f.size <= MAX_SIZE);
    if (validFiles.length === 0) return;
    const newJobs: UploadJob[] = validFiles.map(file => ({ id: crypto.randomUUID().slice(0, 8), file, status: 'queued', progress: 0 }));
    setUploadJobs(prev => [...prev, ...newJobs]);
    newJobs.forEach(job => uploadFile(job));
  };

  const uploadFile = async (job: UploadJob) => {
    setUploadJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'uploading' as const, progress: 10 } : j));
    try {
      const formData = new FormData();
      formData.append('file', job.file);
      const res = await fetch('/api/kb/upload', { method: 'POST', body: formData });
      if (!res.ok) { const error = await res.json(); throw new Error(error.message || 'Upload failed'); }
      const data = await res.json();
      const jobId = data.jobId;
      setUploadJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'processing' as const, jobId, progress: 30 } : j));
      pollJobStatus(job.id, jobId);
    } catch (error) {
      setUploadJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'failed' as const, error: error instanceof Error ? error.message : 'Upload failed' } : j));
      toast({ title: 'Upload failed', description: error instanceof Error ? error.message : 'Upload failed', variant: 'destructive' });
    }
  };

  const pollJobStatus = async (uploadId: string, jobId: string) => {
    const abortController = new AbortController();
    pollingJobsRef.current.set(uploadId, abortController);
    let polling = true;
    let backoffMs = 1000;
    try {
      while (polling && !abortController.signal.aborted) {
        try {
          const res = await fetch(`/api/kb/jobs/${jobId}`, { signal: abortController.signal });
          if (!res.ok) throw new Error('Failed to check job status');
          const status: JobStatus = await res.json();
          setUploadJobs(prev => prev.map(j => {
            if (j.id !== uploadId) return j;
            if (status.status === 'completed') { polling = false; onUploadComplete(); return { ...j, status: 'completed' as const, progress: 100 }; }
            if (status.status === 'failed') { polling = false; return { ...j, status: 'failed' as const, error: status.error || 'Processing failed' }; }
            return { ...j, progress: status.status === 'processing' ? 60 : 40 };
          }));
          if (!polling) break;
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, backoffMs);
            abortController.signal.addEventListener('abort', () => { clearTimeout(timeout); reject(new Error('Aborted')); });
          });
          backoffMs = Math.min(backoffMs * 1.5, 5000);
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') break;
          console.error('Polling error:', error);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } finally { pollingJobsRef.current.delete(uploadId); }
  };

  const removeJob = (jobId: string) => { setUploadJobs(prev => prev.filter(j => j.id !== jobId)); };
  const clearCompleted = () => { setUploadJobs(prev => prev.filter(j => j.status !== 'completed' && j.status !== 'failed')); };

  const getStatusIcon = (status: UploadJob['status']) => {
    switch (status) {
      case 'queued': return <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
      case 'uploading':
      case 'processing': return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />;
      case 'completed': return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
      case 'failed': return <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
    }
  };

  const hasActiveJobs = uploadJobs.some(j => j.status === 'uploading' || j.status === 'processing');
  const hasCompletedJobs = uploadJobs.some(j => j.status === 'completed' || j.status === 'failed');

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2"><Upload className="h-5 w-5" />Upload Documents</h2>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${isDragging ? 'border-primary bg-primary/5 shadow-inner' : 'border-muted-foreground/20 hover:border-primary/40 hover:bg-accent/30'}`}
        data-testid="dropzone-upload"
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
        <p className="text-sm font-medium mb-0.5">Drop files here or click to browse</p>
        <p className="text-xs text-muted-foreground">PDF, PNG, JPEG — max 10MB per file</p>
        <input ref={fileInputRef} type="file" multiple accept=".pdf,image/png,image/jpeg" onChange={handleFileSelect} className="hidden" data-testid="input-file-multiple" />
      </div>
      {uploadJobs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {hasActiveJobs ? `Processing ${uploadJobs.filter(j => j.status === 'uploading' || j.status === 'processing').length} of ${uploadJobs.length}` : `${uploadJobs.length} file${uploadJobs.length > 1 ? 's' : ''}`}
            </p>
            {hasCompletedJobs && !hasActiveJobs && (
              <Button variant="ghost" size="sm" onClick={clearCompleted} data-testid="button-clear-completed">
                Clear all
              </Button>
            )}
          </div>
          <div className="space-y-1" data-testid="upload-queue">
            {uploadJobs.map(job => (
              <div key={job.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent/30 transition-colors group" data-testid={`upload-job-${job.id}`}>
                {getStatusIcon(job.status)}
                <span className="text-sm truncate flex-1 min-w-0" data-testid={`text-filename-${job.id}`}>{job.file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{(job.file.size / 1024).toFixed(0)} KB</span>
                {(job.status === 'uploading' || job.status === 'processing') && (
                  <div className="w-16 shrink-0">
                    <Progress value={job.progress} className="h-1" data-testid={`progress-${job.id}`} />
                  </div>
                )}
                {job.status === 'failed' && (
                  <span className="text-xs text-destructive shrink-0 max-w-[120px] truncate" title={job.error} data-testid={`text-error-${job.id}`}>
                    {job.error}
                  </span>
                )}
                {(job.status === 'completed' || job.status === 'failed') && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => removeJob(job.id)} data-testid={`button-remove-${job.id}`}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentsTab() {
  const { stats, documentsData, documentsLoading, searchQuery, setSearchQuery, searchData, searching, handleUploadComplete, handleDelete, deleteMutation } = useKnowledgeBase();

  const [docSearch, setDocSearch] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredDocuments = useMemo(() => {
    if (!documentsData?.documents) return [];
    return documentsData.documents.filter((doc: DocumentWithStatus) => {
      const matchesSearch = !docSearch || doc.name.toLowerCase().includes(docSearch.toLowerCase());
      const matchesType = fileTypeFilter === "all" || doc.fileType === fileTypeFilter;
      const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [documentsData?.documents, docSearch, fileTypeFilter, statusFilter]);

  const clearFilters = useCallback(() => {
    setDocSearch("");
    setFileTypeFilter("all");
    setStatusFilter("all");
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SupportedFormats />
        {stats && <div className="flex gap-4 text-sm"><div className="text-center"><div className="text-2xl font-bold" data-testid="text-total-documents">{stats.totalDocuments}</div><div className="text-muted-foreground">Documents</div></div><div className="text-center"><div className="text-2xl font-bold" data-testid="text-total-chunks">{stats.totalChunks}</div><div className="text-muted-foreground">Chunks</div></div></div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <BatchUploadPanel onUploadComplete={handleUploadComplete} />
        </Card>
        <Card className="p-6 lg:col-span-2"><h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Search className="h-5 w-5" />Search Documents</h2><div className="space-y-4"><div className="flex gap-2"><Input placeholder="Ask a question or search for information..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} data-testid="input-search-query" />{searching && <Loader2 className="h-5 w-5 animate-spin self-center" />}</div>{searchQuery.length > 0 && searchQuery.length < 3 && <div className="text-sm text-muted-foreground flex items-center gap-2"><AlertCircle className="h-4 w-4" />Type at least 3 characters to search</div>}{searchData?.results.length > 0 && <ScrollArea className="h-96"><div className="space-y-4" data-testid="search-results">{searchData.results.map((result) => <Card key={result.chunkId} className="p-4 border-l-4 border-primary"><div className="flex items-start justify-between mb-2"><div><div className="font-medium text-sm" data-testid={`text-doc-name-${result.chunkId}`}>{result.docName}</div><div className="text-xs text-muted-foreground">Similarity: {(result.similarity * 100).toFixed(1)}% • Chunk {result.ord + 1}</div></div></div><p className="text-sm leading-relaxed" data-testid={`text-chunk-${result.chunkId}`}>{result.text}</p></Card>)}</div></ScrollArea>}{!searchQuery && <EmptyState type="no-search" />}{searchData?.results.length === 0 && <EmptyState type="no-results" />}</div></Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <h2 className="text-xl font-semibold">Uploaded Documents</h2>
        </div>
        <div className="mb-4">
          <DocumentFilters
            search={docSearch}
            onSearchChange={setDocSearch}
            fileTypeFilter={fileTypeFilter}
            onFileTypeFilterChange={setFileTypeFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onClearFilters={clearFilters}
          />
        </div>
        {documentsLoading ? <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : filteredDocuments.length > 0 ? <div className="space-y-2" data-testid="documents-list">{filteredDocuments.map((doc: Document) => <div key={doc.id} className="flex items-center justify-between p-3 border rounded hover:bg-accent/50 transition-colors" data-testid={`document-${doc.id}`}><div className="flex items-center gap-3"><FileText className="h-5 w-5 text-muted-foreground" /><div><div className="font-medium" data-testid={`text-name-${doc.id}`}>{doc.name}</div><div className="text-xs text-muted-foreground">{doc.fileType.toUpperCase()} • {doc.numChunks} chunks • {new Date(doc.createdAt).toLocaleDateString()}</div></div></div><Button variant="ghost" size="sm" onClick={() => handleDelete(doc.id, doc.name)} disabled={deleteMutation.isPending} data-testid={`button-delete-${doc.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div> : documentsData?.documents.length === 0 ? <EmptyState type="no-documents" /> : <EmptyState type="no-results" />}
      </Card>
    </div>
  );
}

function ChatTab() {
  return (
    <div className="flex-1 p-6">
      <ChatInterface />
    </div>
  );
}

function getTabFromSearch(search: string): "chat" | "documents" {
  const params = new URLSearchParams(search.startsWith("?") ? search : search);
  const tab = params.get("tab");
  if (tab === "documents") return "documents";
  return "chat";
}

export default function KnowledgeBasePage() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"chat" | "documents">(() =>
    getTabFromSearch(searchString || window.location.search)
  );

  useEffect(() => {
    setActiveTab(getTabFromSearch(searchString || ""));
  }, [searchString]);

  const handleTabChange = (value: string) => {
    const tab = value as "chat" | "documents";
    setActiveTab(tab);
    const url = tab === "chat" ? "/knowledge-base" : "/knowledge-base?tab=documents";
    setLocation(url, { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col" data-testid="page-knowledge-base">
      <div className="px-6 pt-4">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList data-testid="kb-tabs">
            <TabsTrigger value="chat" className="flex items-center gap-2" data-testid="tab-chat">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2" data-testid="tab-documents">
              <BookOpen className="h-4 w-4" />
              Documents
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {activeTab === "chat" ? <ChatTab /> : <DocumentsTab />}
    </div>
  );
}
