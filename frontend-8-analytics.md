# ARUS Frontend — Part 8: Analytics (Dashboard, Charts, AI, KB, RAG)
Generated: 2026-03-26T02:38:14Z

### `client/src/pages/knowledge-base.tsx` (109 lines)

```tsx
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, Search, FileText, Loader2, AlertCircle, Trash2, X, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useKnowledgeBase, type Document } from "@/features/ml-ai";
import { PageHeader } from "@/components/navigation";
import { DocumentFilters, EmptyState, SupportedFormats } from "@/components/kb";

interface UploadJob { id: string; file: File; status: 'queued' | 'uploading' | 'processing' | 'completed' | 'failed'; jobId?: string; progress: number; error?: string; }
interface JobStatus { id: string; status: 'pending' | 'processing' | 'completed' | 'failed'; progress?: number; error?: string; result?: Record<string, unknown>; }

function BatchUploadPanel({ onUploadComplete }: { onUploadComplete: () => void }) {
  const { toast } = useToast();
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingJobsRef = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => { return () => { pollingJobsRef.current.forEach(controller => controller.abort()); pollingJobsRef.current.clear(); }; }, []);

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.type.startsWith('image/')); if (files.length > 0) {addFiles(files);} else {toast({ title: 'Invalid files', description: 'Please upload PDF or image files only.', variant: 'destructive' });} }, [toast]);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => { setIsDragging(false); }, []);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const files = Array.from(e.target.files ?? []); if (files.length > 0) {addFiles(files);} if (fileInputRef.current) {fileInputRef.current.value = '';} };

  const addFiles = (files: File[]) => { const MAX_SIZE = 10 * 1024 * 1024; const oversizedFiles = files.filter(f => f.size > MAX_SIZE); if (oversizedFiles.length > 0) {toast({ title: 'Files too large', description: `${oversizedFiles.length} file(s) exceed the 10MB limit and were not added.`, variant: 'destructive' });} const validFiles = files.filter(f => f.size <= MAX_SIZE); if (validFiles.length === 0) {return;} const newJobs: UploadJob[] = validFiles.map(file => ({ id: crypto.randomUUID().slice(0, 8), file, status: 'queued', progress: 0 })); setUploadJobs(prev => [...prev, ...newJobs]); newJobs.forEach(job => uploadFile(job)); };

  const uploadFile = async (job: UploadJob) => { setUploadJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'uploading' as const, progress: 10 } : j)); try { const formData = new FormData(); formData.append('file', job.file); const res = await fetch('/api/kb/upload', { method: 'POST', body: formData }); if (!res.ok) { const error = await res.json(); throw new Error(error.message || 'Upload failed'); } const data = await res.json(); const jobId = data.jobId; setUploadJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'processing' as const, jobId, progress: 30 } : j)); pollJobStatus(job.id, jobId); } catch (error) { setUploadJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'failed' as const, error: error instanceof Error ? error.message : 'Upload failed' } : j)); toast({ title: 'Upload failed', description: error instanceof Error ? error.message : 'Upload failed', variant: 'destructive' }); } };

  const pollJobStatus = async (uploadId: string, jobId: string) => { const abortController = new AbortController(); pollingJobsRef.current.set(uploadId, abortController); let polling = true; let backoffMs = 1000; try { while (polling && !abortController.signal.aborted) { try { const res = await fetch(`/api/kb/jobs/${jobId}`, { signal: abortController.signal }); if (!res.ok) {throw new Error('Failed to check job status');} const status: JobStatus = await res.json(); setUploadJobs(prev => prev.map(j => { if (j.id !== uploadId) {return j;} if (status.status === 'completed') { polling = false; onUploadComplete(); return { ...j, status: 'completed' as const, progress: 100 }; } if (status.status === 'failed') { polling = false; return { ...j, status: 'failed' as const, error: status.error || 'Processing failed' }; }  return { ...j, progress: status.status === 'processing' ? 60 : 40 };  })); if (!polling) {break;} await new Promise((resolve, reject) => { const timeout = setTimeout(resolve, backoffMs); abortController.signal.addEventListener('abort', () => { clearTimeout(timeout); reject(new Error('Aborted')); }); }); backoffMs = Math.min(backoffMs * 1.5, 5000); } catch (error) { if (error instanceof Error && error.name === 'AbortError') {break;} console.error('Polling error:', error); await new Promise(resolve => setTimeout(resolve, 2000)); } } } finally { pollingJobsRef.current.delete(uploadId); } };

  const removeJob = (jobId: string) => { setUploadJobs(prev => prev.filter(j => j.id !== jobId)); };
  const clearCompleted = () => { setUploadJobs(prev => prev.filter(j => j.status !== 'completed' && j.status !== 'failed')); };
  const getStatusIcon = (status: UploadJob['status']) => { switch (status) { case 'queued': return <Clock className="h-4 w-4 text-muted-foreground" />; case 'uploading': case 'processing': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />; case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />; case 'failed': return <XCircle className="h-4 w-4 text-destructive" />; } };

  const hasActiveJobs = uploadJobs.some(j => j.status === 'uploading' || j.status === 'processing');
  const hasCompletedJobs = uploadJobs.some(j => j.status === 'completed' || j.status === 'failed');

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Upload className="h-5 w-5" />Upload Documents</h2>
      <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`} data-testid="dropzone-upload"><Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground" /><p className="text-sm font-medium mb-1">Drop files here or click to browse</p><p className="text-xs text-muted-foreground">Supports PDF, PNG, JPEG (Max 10MB per file)</p><input ref={fileInputRef} type="file" multiple accept=".pdf,image/png,image/jpeg" onChange={handleFileSelect} className="hidden" data-testid="input-file-multiple" /></div>
      {uploadJobs.length > 0 && <div className="mt-4 space-y-2"><div className="flex items-center justify-between"><p className="text-sm font-medium">Upload Queue ({uploadJobs.length})</p>{hasCompletedJobs && !hasActiveJobs && <Button variant="ghost" size="sm" onClick={clearCompleted} data-testid="button-clear-completed">Clear Completed</Button>}</div><ScrollArea className="max-h-96"><div className="space-y-2" data-testid="upload-queue">{uploadJobs.map(job => <div key={job.id} className="p-3 border rounded-lg space-y-2" data-testid={`upload-job-${job.id}`}><div className="flex items-center justify-between"><div className="flex items-center gap-2 flex-1 min-w-0">{getStatusIcon(job.status)}<span className="text-sm font-medium truncate" data-testid={`text-filename-${job.id}`}>{job.file.name}</span><span className="text-xs text-muted-foreground">({(job.file.size / 1024).toFixed(1)} KB)</span></div><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground capitalize" data-testid={`text-status-${job.id}`}>{job.status}</span>{(job.status === 'completed' || job.status === 'failed') && <Button variant="ghost" size="sm" onClick={() => removeJob(job.id)} data-testid={`button-remove-${job.id}`}><X className="h-4 w-4" /></Button>}</div></div>{job.status !== 'completed' && job.status !== 'failed' && <Progress value={job.progress} className="h-1" data-testid={`progress-${job.id}`} />}{job.error && <p className="text-xs text-destructive" data-testid={`text-error-${job.id}`}>{job.error}</p>}</div>)}</div></ScrollArea></div>}
    </Card>
  );
}

export default function KnowledgeBasePage() {
  const { stats, documentsData, documentsLoading, searchQuery, setSearchQuery, searchData, searching, handleUploadComplete, handleDelete, deleteMutation } = useKnowledgeBase();
  
  const [docSearch, setDocSearch] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const filteredDocuments = useMemo(() => {
    if (!documentsData?.documents) return [];
    return documentsData.documents.filter((doc: Document) => {
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
    <div className="min-h-screen" data-testid="page-knowledge-base">
      <PageHeader title="Knowledge Base" />
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <SupportedFormats />
          {stats && <div className="flex gap-4 text-sm"><div className="text-center"><div className="text-2xl font-bold" data-testid="text-total-documents">{stats.totalDocuments}</div><div className="text-muted-foreground">Documents</div></div><div className="text-center"><div className="text-2xl font-bold" data-testid="text-total-chunks">{stats.totalChunks}</div><div className="text-muted-foreground">Chunks</div></div></div>}
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <BatchUploadPanel onUploadComplete={handleUploadComplete} />
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
    </div>
  );
}

```

### `client/src/pages/kb-chat.tsx` (13 lines)

```tsx
import { PageHeader } from '@/components/navigation';
import { ChatInterface } from '@/components/rag';

export default function KnowledgeBaseChatPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader title="Knowledge Base Assistant" />
      <div className="flex-1 p-6">
        <ChatInterface />
      </div>
    </div>
  );
}

```

### `client/src/pages/scheduled-reports.tsx` (383 lines)

```tsx
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Plus, Calendar, Mail, FileText, Clock, Play, Trash2 } from 'lucide-react';
import type { ReportSchedule } from '@shared/schema/scheduled-reports';

const REPORT_TYPES = [
  { id: 'fleet_health', name: 'Fleet Health Summary' },
  { id: 'maintenance_due', name: 'Maintenance Due Report' },
  { id: 'inventory_status', name: 'Inventory Status Report' },
  { id: 'crew_compliance', name: 'Crew Compliance Report' },
  { id: 'cost_summary', name: 'Cost Summary Report' },
] as const;

const FREQUENCIES = [
  { id: 'daily', name: 'Daily', cron: '0 8 * * *' },
  { id: 'weekly', name: 'Weekly', cron: '0 8 * * 1' },
  { id: 'monthly', name: 'Monthly', cron: '0 8 1 * *' },
] as const;

const FORMATS = [
  { id: 'pdf', name: 'PDF' },
  { id: 'csv', name: 'CSV' },
  { id: 'json', name: 'JSON' },
] as const;

const createScheduleFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  reportType: z.enum(['fleet_health', 'maintenance_due', 'inventory_status', 'crew_compliance', 'cost_summary']),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  format: z.enum(['pdf', 'csv', 'json']),
  recipients: z.string().min(1, 'At least one recipient is required'),
  enabled: z.boolean(),
});

type CreateScheduleForm = z.infer<typeof createScheduleFormSchema>;

export default function ScheduledReports() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const form = useForm<CreateScheduleForm>({
    resolver: zodResolver(createScheduleFormSchema),
    defaultValues: {
      name: '',
      reportType: 'fleet_health',
      frequency: 'weekly',
      format: 'pdf',
      recipients: '',
      enabled: true,
    },
  });

  const { data: schedulesResponse, isLoading } = useQuery<{ data: ReportSchedule[] }>({
    queryKey: ['/api/scheduled-reports/schedules'],
  });

  const schedules = schedulesResponse?.data || [];

  const createMutation = useMutation({
    mutationFn: async (data: CreateScheduleForm) => {
      const cronExpr = FREQUENCIES.find(f => f.id === data.frequency)?.cron || '0 8 * * *';
      const recipientList = data.recipients.split(',').map((r) => r.trim()).filter(Boolean);
      
      return apiRequest('POST', '/api/scheduled-reports/schedules', {
        name: data.name,
        reportType: data.reportType,
        frequency: data.frequency,
        cronExpression: cronExpr,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        format: data.format,
        recipients: recipientList,
        vesselIds: null,
        enabled: data.enabled,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-reports/schedules'] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: 'Schedule created', description: 'Your report schedule has been created.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create schedule.', variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest('PATCH', `/api/scheduled-reports/schedules/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-reports/schedules'] });
    },
  });

  const runNowMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/scheduled-reports/schedules/${id}/run`);
    },
    onSuccess: () => {
      toast({ title: 'Report generating', description: 'Your report is being generated.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to run report.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/scheduled-reports/schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-reports/schedules'] });
      toast({ title: 'Schedule deleted', description: 'Your report schedule has been deleted.' });
    },
  });

  const handleSubmit = (data: CreateScheduleForm) => {
    createMutation.mutate(data);
  };

  const getReportTypeName = (id: string) => {
    return REPORT_TYPES.find((t) => t.id === id)?.name || id;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-scheduled-reports">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Scheduled Reports</h1>
          <p className="text-muted-foreground">Automate report generation and delivery</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-schedule">
              <Plus className="w-4 h-4 mr-2" />
              New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Report Schedule</DialogTitle>
              <DialogDescription>Set up automated report generation and delivery.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-schedule-name"
                          placeholder="Weekly Fleet Health Report"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reportType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Report Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-report-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REPORT_TYPES.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-frequency">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FREQUENCIES.map((freq) => (
                              <SelectItem key={freq.id} value={freq.id}>
                                {freq.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="format"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Format</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-format">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FORMATS.map((fmt) => (
                              <SelectItem key={fmt.id} value={fmt.id}>
                                {fmt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="recipients"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipients (comma-separated emails)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-recipients"
                          placeholder="admin@company.com, ops@company.com"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-schedule">
                    {createMutation.isPending ? 'Creating...' : 'Create Schedule'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-full mb-2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No scheduled reports</h3>
            <p className="text-muted-foreground mb-4">Create your first automated report schedule.</p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first">
              <Plus className="w-4 h-4 mr-2" />
              Create Schedule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {schedules.map((schedule) => (
            <Card key={schedule.id} data-testid={`card-schedule-${schedule.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate" data-testid={`text-schedule-name-${schedule.id}`}>
                      {schedule.name}
                    </CardTitle>
                    <CardDescription className="truncate">
                      {getReportTypeName(schedule.reportType)}
                    </CardDescription>
                  </div>
                  <Switch
                    checked={schedule.enabled}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: schedule.id, enabled: checked })
                    }
                    data-testid={`switch-enabled-${schedule.id}`}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    <Clock className="w-3 h-3 mr-1" />
                    {schedule.frequency}
                  </Badge>
                  <Badge variant="outline">
                    <FileText className="w-3 h-3 mr-1" />
                    {schedule.format.toUpperCase()}
                  </Badge>
                  <Badge variant="outline">
                    <Mail className="w-3 h-3 mr-1" />
                    {(schedule.recipients as string[])?.length || 0}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Last run: {formatDate(schedule.lastRunAt)}</p>
                  <p>Next run: {formatDate(schedule.nextRunAt)}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runNowMutation.mutate(schedule.id)}
                    disabled={runNowMutation.isPending}
                    data-testid={`button-run-${schedule.id}`}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Run Now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(schedule.id)}
                    data-testid={`button-delete-${schedule.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

```

### `client/src/pages/scheduled-reports-settings.tsx` (204 lines)

```tsx
import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useScheduledReportsSettingsData } from "@/features/settings";
import { useState, useEffect } from "react";

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
];

export default function ScheduledReportsSettingsPage() {
  const {
    settings,
    isLoadingSettings,
    handleUpdateRetentionDays,
    handleUpdateDefaultTimezone,
    handleUpdateMaxRecipients,
    handleUpdateTimeout,
    updateSettingsMutation,
  } = useScheduledReportsSettingsData();

  const [retentionDays, setRetentionDays] = useState(settings.reportRetentionDays);
  const [maxRecipients, setMaxRecipients] = useState(settings.maxRecipientsPerSchedule);
  const [timeout, setTimeout] = useState(settings.reportGenerationTimeoutSeconds);

  useEffect(() => {
    setRetentionDays(settings.reportRetentionDays);
    setMaxRecipients(settings.maxRecipientsPerSchedule);
    setTimeout(settings.reportGenerationTimeoutSeconds);
  }, [settings]);

  if (isLoadingSettings) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-8">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="p-2 bg-primary/10 rounded-lg">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Scheduled Reports Settings</h1>
          <p className="text-muted-foreground">Configure report generation and delivery preferences</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report Retention</CardTitle>
            <CardDescription>How long to keep generated reports before automatic cleanup</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="retention-days" className="w-32">Retention Period</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="retention-days"
                  type="number"
                  min={1}
                  max={365}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  onBlur={() => {
                    if (retentionDays !== settings.reportRetentionDays && retentionDays >= 1 && retentionDays <= 365) {
                      handleUpdateRetentionDays(retentionDays);
                    }
                  }}
                  className="w-24"
                  data-testid="input-retention-days"
                />
                <span className="text-muted-foreground">days</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Reports older than this will be automatically deleted. Valid range: 1-365 days.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Default Timezone</CardTitle>
            <CardDescription>Timezone used for scheduling new reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="timezone" className="w-32">Timezone</Label>
              <Select
                value={settings.defaultTimezone}
                onValueChange={(value) => handleUpdateDefaultTimezone(value)}
              >
                <SelectTrigger className="w-64" data-testid="select-timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              This is the default timezone for new scheduled reports. Individual schedules can override this.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email Recipients Limit</CardTitle>
            <CardDescription>Maximum number of email recipients per report schedule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="max-recipients" className="w-32">Max Recipients</Label>
              <Input
                id="max-recipients"
                type="number"
                min={1}
                max={50}
                value={maxRecipients}
                onChange={(e) => setMaxRecipients(Number(e.target.value))}
                onBlur={() => {
                  if (maxRecipients !== settings.maxRecipientsPerSchedule && maxRecipients >= 1 && maxRecipients <= 50) {
                    handleUpdateMaxRecipients(maxRecipients);
                  }
                }}
                className="w-24"
                data-testid="input-max-recipients"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Limits the number of email addresses that can receive a single report. Valid range: 1-50.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generation Timeout</CardTitle>
            <CardDescription>Maximum time allowed for report generation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="timeout" className="w-32">Timeout</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="timeout"
                  type="number"
                  min={30}
                  max={600}
                  value={timeout}
                  onChange={(e) => setTimeout(Number(e.target.value))}
                  onBlur={() => {
                    if (timeout !== settings.reportGenerationTimeoutSeconds && timeout >= 30 && timeout <= 600) {
                      handleUpdateTimeout(timeout);
                    }
                  }}
                  className="w-24"
                  data-testid="input-timeout"
                />
                <span className="text-muted-foreground">seconds</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              If a report takes longer than this to generate, it will be marked as failed. Valid range: 30-600 seconds.
            </p>
          </CardContent>
        </Card>
      </div>

      {updateSettingsMutation.isPending && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg">
          Saving...
        </div>
      )}
    </div>
  );
}

```

### `client/src/components/InsightsOverview.tsx` (295 lines)

```tsx
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Brain,
  TrendingUp,
  Target,
  Zap,
  RefreshCw,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchLatestInsightSnapshot,
  triggerInsightsGeneration,
  fetchInsightsJobStats,
} from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface InsightSnapshotData {
  id: string;
  createdAt: string;
  summary?: string;
  insights?: Array<{ type: string; title: string; description: string; severity?: string }>;
  metrics?: { healthScore?: number; efficiency?: number; uptime?: number };
}

interface JobStatsData {
  total: number;
  completed: number;
  failed: number;
  pending: number;
}

interface InsightsOverviewProps {
  orgId?: string;
  scope?: string;
  prefetchedSnapshot?: InsightSnapshotData | null;
  prefetchedJobStats?: JobStatsData | null;
}

export function InsightsOverview({
  orgId = "default-org-id",
  scope = "fleet",
  prefetchedSnapshot,
  prefetchedJobStats,
}: InsightsOverviewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Fetch latest insights snapshot - use initialData for prefetched data so mutations can still refetch
  const {
    data: latestSnapshot,
    isLoading: snapshotLoading,
    error: snapshotError,
  } = useQuery({
    queryKey: ["/api/insights/snapshots/latest", orgId, scope],
    queryFn: () => fetchLatestInsightSnapshot(orgId, scope),
    staleTime: 300000,
    refetchInterval: 300000,
    initialData: prefetchedSnapshot ?? undefined,
    retry: (failureCount, error: Error) => {
      if (error?.message?.includes("404")) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const { data: jobStats } = useQuery({
    queryKey: ["/api/insights/jobs/stats"],
    queryFn: fetchInsightsJobStats,
    staleTime: 120000,
    refetchInterval: 120000,
    initialData: prefetchedJobStats ?? undefined,
  });

  const handleGenerateInsights = async () => {
    setIsGenerating(true);
    try {
      await triggerInsightsGeneration(orgId, scope);
      toast({
        title: "Insights Generation Started",
        description: "Fleet insights are being generated. This may take 1-2 minutes.",
      });

      // Refresh the snapshot query after a short delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/insights/snapshots/latest"] });
      }, 5000);
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: (error as Error).message || "Failed to generate insights",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Show loading state
  if (snapshotLoading && !latestSnapshot) {
    return (
      <Card data-testid="insights-overview">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fleet Insights</CardTitle>
          <Brain className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no snapshots exist yet
  if (snapshotError || !latestSnapshot) {
    return (
      <Card data-testid="insights-overview">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fleet Insights</CardTitle>
          <Brain className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              No insights generated yet. Create your first fleet insights analysis.
            </p>
            <Button
              onClick={handleGenerateInsights}
              disabled={isGenerating}
              size="sm"
              data-testid="button-generate-insights"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Generate Insights
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { kpi, risks, recommendations } = latestSnapshot;
  const generatedAt = new Date(latestSnapshot.createdAt);

  const totalRisks = (risks?.critical?.length || 0) + (risks?.warnings?.length || 0);
  const riskLevel =
    (risks?.critical?.length || 0) > 0
      ? "High"
      : (risks?.warnings?.length || 0) > 0
        ? "Medium"
        : "Low";

  return (
    <div className="space-y-4" data-testid="insights-overview">
      {/* Compact Header with Inline Stats */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <CardTitle className="text-sm font-medium">Fleet Insights</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Generated {formatDistanceToNow(generatedAt, { addSuffix: true })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {jobStats?.totalJobs > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {jobStats.completedJobs}/{jobStats.totalJobs}
                </Badge>
              )}
              <Button
                onClick={handleGenerateInsights}
                disabled={isGenerating}
                size="sm"
                variant="outline"
                data-testid="button-refresh-insights"
              >
                {isGenerating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Compact Inline Stats */}
          <div className="flex flex-wrap items-center gap-4 md:gap-6 px-3 py-2 bg-muted/30 dark:bg-muted/20 rounded-lg border border-border/50">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Vessels:</span>
              <span className="text-sm font-bold" data-testid="metric-fleet-vessels">
                {kpi?.fleet?.vessels || 0}
              </span>
              <span className="text-xs text-muted-foreground">
                ({kpi?.fleet?.signalsMapped || 0} mapped)
              </span>
            </div>
            <div className="hidden md:block h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`h-4 w-4 ${riskLevel === "High" ? "text-red-600 dark:text-red-400" : riskLevel === "Medium" ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}
              />
              <span className="text-sm text-muted-foreground">Risk:</span>
              <span
                className={`text-sm font-bold ${riskLevel === "High" ? "text-red-700 dark:text-red-300" : riskLevel === "Medium" ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-300"}`}
                data-testid="metric-risk-level"
              >
                {riskLevel}
              </span>
              <span className="text-xs text-muted-foreground">({totalRisks} factors)</span>
            </div>
            <div className="hidden md:block h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Signals:</span>
              <span className="text-sm font-bold" data-testid="metric-discovered-signals">
                {kpi?.fleet?.signalsDiscovered || 0}
              </span>
              <span className="text-xs text-muted-foreground">
                ({kpi?.fleet?.dq7d || 0} DQ events)
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Risk Summary */}
          {(risks?.critical?.length > 0 || risks?.warnings?.length > 0) && (
            <div className="mt-6">
              <h4 className="text-sm font-medium mb-3">Active Risks</h4>
              <div className="space-y-2">
                {risks.critical?.slice(0, 2).map((risk: string, index: number) => (
                  <div key={`critical-${index}`} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-muted-foreground" data-testid={`risk-critical-${index}`}>
                      {risk}
                    </p>
                  </div>
                ))}
                {risks.warnings?.slice(0, 1).map((risk: string, index: number) => (
                  <div key={`warning-${index}`} className="flex items-start gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
                    <p className="text-muted-foreground" data-testid={`risk-warning-${index}`}>
                      {risk}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations Preview */}
          {recommendations?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Top Recommendations</h4>
              <div className="space-y-2">
                {recommendations.slice(0, 3).map((rec: string, index: number) => (
                  <div key={rec} className="flex items-start gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-chart-3 mt-2 flex-shrink-0" />
                    <p className="text-muted-foreground" data-testid={`recommendation-${index}`}>
                      {rec}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

```

### `client/src/components/analytics/ContextHelp.tsx` (35 lines)

```tsx
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ContextHelpProps {
  title: string;
  description: string;
  className?: string;
}

/**
 * ContextHelp component - Provides contextual tooltips explaining metrics and features
 */
export function ContextHelp({ title, description, className = "" }: ContextHelpProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={`inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${className}`}
            data-testid="context-help"
            aria-label={`Help: ${title}`}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

```

### `client/src/components/analytics/DataIntegrityDashboard.tsx` (118 lines)

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExportButton } from "@/components/ui/export-button";
import { Shield, Database, AlertTriangle, CheckCircle2, RefreshCw, Clock, FileWarning, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatDate } from "@/lib/formatters";
import { DataQualityChart } from "@/components/charts/DataQualityChart";
import { IssueTypeChart } from "@/components/charts/IssueTypeChart";
import { useDataIntegrityData } from "@/features/analytics";

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6" data-testid="loading-integrity-dashboard">
      <Skeleton className="h-32 w-full" data-testid="skeleton-header" />
      <Skeleton className="h-64 w-full" data-testid="skeleton-cards" />
      <Skeleton className="h-96 w-full" data-testid="skeleton-report" />
    </div>
  );
}

function ErrorAlert({ error }: { error: Error | unknown }) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    <div className="space-y-6 p-6">
      <Alert variant="destructive" data-testid="alert-status-error">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription data-testid="text-status-error-message">
          Failed to load reconciliation status: {message}
        </AlertDescription>
      </Alert>
    </div>
  );
}

function getHealthRating(percentage: number): { variant: "default" | "secondary" | "destructive"; label: string } {
  if (percentage >= 95) {return { variant: "default", label: "Excellent" };}
  if (percentage >= 80) {return { variant: "secondary", label: "Good" };}
  return { variant: "destructive", label: "Poor" };
}

function getReportStatusVariant(status: string): "default" | "destructive" | "secondary" {
  if (status === "completed") {return "default";}
  if (status === "failed") {return "destructive";}
  return "secondary";
}

function getSeverityVariant(severity: string): "destructive" | "secondary" | "outline" {
  if (severity === "critical") {return "destructive";}
  if (severity === "warning") {return "secondary";}
  return "outline";
}

function getNoReportMessage(reportError: Error | unknown): string {
  if (reportError instanceof Error && reportError.message.includes("404")) {
    return 'No reconciliation report available yet. Click "Run Integrity Check" to generate the first report.';
  }

  if (reportError) {
    const errorMsg = reportError instanceof Error ? reportError.message : "Unknown error";
    return `Failed to load reconciliation report: ${errorMsg}`;
  }
  return "No reconciliation report available. The report will appear after the first data integrity check completes.";
}

export function DataIntegrityDashboard() {
  const { status, statusLoading, statusError, latestReport, reportLoading, reportError, healthPercentage, runReconciliation, handleRunReconciliation, exportPDFSections, exportTableData, exportCSVData } = useDataIntegrityData();

  if (statusLoading || reportLoading) {return <LoadingSkeleton />;}
  if (statusError) {return <ErrorAlert error={statusError} />;}

  const healthRating = getHealthRating(healthPercentage);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6 text-primary" />Data Integrity Monitor</h2><p className="text-sm text-muted-foreground mt-1">Automated telemetry validation and consistency checks</p></div>
        <div className="flex items-center gap-2">
          <ExportButton data={exportCSVData} filename="data-integrity-report" formats={exportTableData ? ["csv", "pdf", "pdf-table"] : ["csv", "pdf"]} pdfSections={exportPDFSections} pdfTableData={exportTableData} csvOptions={{ columns: ["severity", "issueType", "message", "affectedRecords"], headers: { severity: "Severity", issueType: "Issue Type", message: "Message", affectedRecords: "Affected Records" } }} pdfOptions={{ title: "Data Integrity Report", subtitle: `Generated on ${formatDate(new Date())}` }} variant="outline" size="default" data-testid="button-export-report" />
          <Button onClick={handleRunReconciliation} disabled={status?.isRunning || runReconciliation.isPending} data-testid="button-run-reconciliation"><RefreshCw className={`h-4 w-4 mr-2 ${status?.isRunning || runReconciliation.isPending ? "animate-spin" : ""}`} />{status?.isRunning ? "Running..." : "Run Check"}</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-status"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Service Status</CardTitle><Activity className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="flex items-center gap-2">{status?.enabled ? <><CheckCircle2 className="h-5 w-5 text-green-500" data-testid="icon-service-active" /><span className="text-2xl font-bold text-green-600" data-testid="status-service">Active</span></> : <><AlertTriangle className="h-5 w-5 text-amber-500" data-testid="icon-service-disabled" /><span className="text-2xl font-bold text-amber-600" data-testid="status-service">Disabled</span></>}</div><p className="text-xs text-muted-foreground mt-2">Scheduled runs every 60 minutes</p></CardContent></Card>
        <Card data-testid="card-last-run"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Last Run</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold" data-testid="text-last-run">{status?.lastRun ? formatDistanceToNow(new Date(status.lastRun), { addSuffix: true }) : "Never"}</div>{status?.nextScheduledRun && <p className="text-xs text-muted-foreground mt-2" data-testid="text-next-run">Next: {formatDistanceToNow(new Date(status.nextScheduledRun), { addSuffix: true })}</p>}</CardContent></Card>
        <Card data-testid="card-health-score"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Health Score</CardTitle><Database className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="flex items-baseline gap-2"><span className="text-2xl font-bold" data-testid="text-health-score">{healthPercentage}%</span><Badge variant={healthRating.variant} data-testid="badge-health-rating">{healthRating.label}</Badge></div><p className="text-xs text-muted-foreground mt-2" data-testid="text-successful-runs">{status?.successfulRuns || 0} / {status?.totalRuns || 0} successful runs</p></CardContent></Card>
        <Card data-testid="card-total-runs"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Checks</CardTitle><FileWarning className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold" data-testid="text-total-runs">{status?.totalRuns || 0}</div><p className="text-xs text-muted-foreground mt-2" data-testid="text-failed-runs">{status?.failedRuns || 0} failed checks</p></CardContent></Card>
      </div>

      {status?.isRunning && <Alert data-testid="alert-running"><RefreshCw className="h-4 w-4 animate-spin" data-testid="icon-running" /><AlertDescription data-testid="text-running-message">Data integrity check is currently running. This may take a few minutes depending on data volume.</AlertDescription></Alert>}

      {latestReport && <Card data-testid="card-latest-report"><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Latest Reconciliation Report</CardTitle><CardDescription data-testid="text-report-metadata">Run completed {formatDistanceToNow(new Date(latestReport.timestamp), { addSuffix: true })}{" • "}Duration: {(latestReport.duration / 1000).toFixed(2)}s</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3"><div className="space-y-1"><p className="text-sm text-muted-foreground">Total Checks</p><p className="text-2xl font-bold" data-testid="text-total-checks">{latestReport.totalChecks}</p></div><div className="space-y-1"><p className="text-sm text-muted-foreground">Issues Found</p><p className={`text-2xl font-bold ${latestReport.issuesFound > 0 ? "text-amber-600" : "text-green-600"}`} data-testid="text-issues-found">{latestReport.issuesFound}</p></div><div className="space-y-1"><p className="text-sm text-muted-foreground">Status</p><Badge variant={getReportStatusVariant(latestReport.status)} data-testid="badge-report-status">{latestReport.status}</Badge></div></div>
          {latestReport.issues && latestReport.issues.length > 0 && <div className="space-y-3"><h4 className="font-semibold text-sm">Validation Issues</h4><div className="space-y-2">{latestReport.issues.map((issue: { type: string; severity: string; description: string; table: string; count: number }, index: number) => <div key={`${issue.type}-${issue.table}-${issue.severity}`} className="flex items-start justify-between p-3 border rounded-lg" data-testid={`issue-${issue.type}-${index}`}><div className="flex-1"><div className="flex items-center gap-2 mb-1"><Badge variant={getSeverityVariant(issue.severity)} data-testid={`badge-severity-${issue.severity}`}>{issue.severity}</Badge><span className="font-medium text-sm" data-testid={`text-issue-type-${index}`}>{issue.type}</span></div><p className="text-sm text-muted-foreground" data-testid={`text-issue-description-${index}`}>{issue.description}</p><p className="text-xs text-muted-foreground mt-1" data-testid={`text-issue-table-${index}`}>Table: {issue.table}</p></div><div className="text-right"><p className="text-lg font-bold" data-testid={`text-issue-count-${index}`}>{issue.count}</p><p className="text-xs text-muted-foreground">records</p></div></div>)}</div></div>}
          {latestReport.issues && latestReport.issues.length === 0 && <Alert data-testid="alert-success"><CheckCircle2 className="h-4 w-4 text-green-500" data-testid="icon-success" /><AlertDescription className="text-green-600" data-testid="text-success-message">No data integrity issues detected in the last reconciliation run.</AlertDescription></Alert>}
        </CardContent>
      </Card>}

      {!latestReport && !reportLoading && <Alert data-testid="alert-no-report"><AlertTriangle className="h-4 w-4" /><AlertDescription data-testid="text-no-report-message">{getNoReportMessage(reportError)}</AlertDescription></Alert>}

      {latestReport?.issues && latestReport.issues.length > 0 && <div className="grid gap-6 md:grid-cols-2"><DataQualityChart report={latestReport} isLoading={reportLoading} error={reportError instanceof Error ? reportError.message : null} data-testid="chart-data-quality" /><IssueTypeChart report={latestReport} isLoading={reportLoading} error={reportError instanceof Error ? reportError.message : null} data-testid="chart-issue-type" /></div>}

      <Card><CardHeader><CardTitle>About Data Reconciliation</CardTitle><CardDescription>Automated background service ensuring data integrity across the system</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><h4 className="font-semibold mb-2 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" />What it checks</h4><ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc"><li>Orphaned telemetry records without valid equipment</li><li>Data points missing organization context</li><li>Cross-tenant data contamination</li><li>Referential integrity violations</li></ul></div>
            <div><h4 className="font-semibold mb-2 flex items-center gap-2"><Activity className="h-4 w-4 text-blue-500" />How it works</h4><ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc"><li>Runs automatically every 60 minutes</li><li>Non-blocking background processing</li><li>Detailed reporting and metrics</li><li>Manual triggers available for immediate checks</li></ul></div>
          </div>
          <div className="pt-4 border-t"><p className="text-sm text-muted-foreground">This service helps maintain data quality and prevents integrity issues that could affect analytics accuracy or system performance. All validation runs are logged and tracked for audit purposes.</p></div>
        </CardContent>
      </Card>
    </div>
  );
}

```

### `client/src/components/analytics/FinanceMode.tsx` (98 lines)

```tsx
import { TrendingUp, TrendingDown, PieChart, Target, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportButton } from "@/components/ui/export-button";
import { ScenarioBanner } from "./ScenarioBanner";
import { CollapsibleSection } from "./CollapsibleSection";
import { ContextHelp } from "./ContextHelp";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { formatDate } from "@/lib/formatters";
import { useFinanceModeData } from "@/features/analytics";

export function FinanceMode() {
  const { latestMonth, monthlyChange, totalSavings, predictiveSavings, completedInsights, estimatedLLMCost, avgCostPerInsight, openWorkOrders, estimatedFutureDowntime, projectedDowntimeCost, preventiveCost, reactiveCost, preventiveRatio, totalLaborCost, totalLaborHours, avgLaborCostPerHour, workOrdersWithLabor, pendingLaborHours, estimatedPendingLaborCost, roiAnalysis, costBreakdownData, roiTrendData, costTrendsData, exportPDFSections, exportCostTrendsData, COLORS } = useFinanceModeData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Finance Mode</h2>
          <p className="text-sm text-muted-foreground mt-1">Cost intelligence, ROI tracking, and financial optimization</p>
        </div>
        <ExportButton data={exportCostTrendsData} filename="finance-report" formats={["csv", "pdf"]} pdfSections={exportPDFSections} csvOptions={{ columns: ["month", "totalCost", "labor", "parts", "downtime"], headers: { month: "Month", totalCost: "Total Cost", labor: "Labor", parts: "Parts", downtime: "Downtime" } }} pdfOptions={{ title: "Finance Report", subtitle: `Generated on ${formatDate(new Date())}` }} variant="outline" size="default" data-testid="button-export-finance" />
      </div>

      <ScenarioBanner type="info" title="Finance Mode - Cost Intelligence & ROI" description="Track maintenance costs, analyze spending trends, measure ROI from predictive maintenance, and identify cost optimization opportunities. Use this view for budget planning and financial reporting." />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card data-testid="card-total-savings">
          <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Total Savings</CardTitle><ContextHelp title="Total Savings" description="Cumulative cost savings from predictive and preventive maintenance interventions vs. reactive repairs." /></div></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-600" data-testid="text-total-savings">${(totalSavings / 1000).toFixed(0)}k</div></CardContent>
        </Card>
        <Card data-testid="card-monthly-spend">
          <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Monthly Spend</CardTitle><ContextHelp title="Monthly Maintenance Spend" description="Total maintenance costs for the most recent month including labor, parts, and downtime." /></div></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-monthly-spend">${latestMonth ? (latestMonth.totalCost / 1000).toFixed(0) : 0}k</div>
            {monthlyChange !== 0 && <div className={`flex items-center gap-1 mt-1 text-sm ${monthlyChange > 0 ? "text-red-600" : "text-green-600"}`} data-testid="text-monthly-change">{monthlyChange > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(monthlyChange).toFixed(1)}% vs last month</div>}
          </CardContent>
        </Card>
        <Card data-testid="card-predictive-savings">
          <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Predictive Savings</CardTitle><ContextHelp title="Predictive Maintenance Savings" description="Savings from using ML predictions to prevent failures before they occur." /></div></CardHeader>
          <CardContent><div className="text-3xl font-bold text-blue-600" data-testid="text-predictive-savings">${(predictiveSavings / 1000).toFixed(0)}k</div></CardContent>
        </Card>
        <Card data-testid="card-roi">
          <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">ROI</CardTitle><ContextHelp title="Return on Investment" description="Overall ROI from implementing predictive maintenance vs. traditional reactive maintenance." /></div></CardHeader>
          <CardContent><div className="text-3xl font-bold text-purple-600" data-testid="text-roi">{roiAnalysis?.overallRoi ? `${roiAnalysis.overallRoi.toFixed(0)}%` : "N/A"}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-llm-cost">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" />AI Insights Cost</CardTitle></CardHeader>
          <CardContent><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Reports Generated</span><span className="text-lg font-bold" data-testid="text-llm-reports">{completedInsights}</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Est. LLM Cost</span><span className="text-sm font-medium text-blue-600" data-testid="text-llm-cost">${estimatedLLMCost.toFixed(2)}</span></div><p className="text-xs text-muted-foreground mt-2">Avg ${avgCostPerInsight}/report</p></div></CardContent>
        </Card>
        <Card className={projectedDowntimeCost > 10000 ? "border-amber-500" : ""} data-testid="card-downtime-projections">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4" />Downtime Projections</CardTitle></CardHeader>
          <CardContent><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Projected Cost</span><span className="text-lg font-bold text-amber-600" data-testid="text-projected-cost">${(projectedDowntimeCost / 1000).toFixed(0)}k</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Est. Hours</span><span className="text-sm font-medium" data-testid="text-projected-hours">{estimatedFutureDowntime.toFixed(0)}h</span></div><p className="text-xs text-muted-foreground mt-2"><span data-testid="text-open-orders">{openWorkOrders.length}</span> open work orders</p></div></CardContent>
        </Card>
        <Card data-testid="card-preventive-reactive">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><PieChart className="h-4 w-4" />Preventive vs Reactive</CardTitle></CardHeader>
          <CardContent><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Preventive Ratio</span><span className="text-lg font-bold text-green-600" data-testid="text-preventive-ratio">{preventiveRatio.toFixed(0)}%</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Preventive Cost</span><span className="text-sm font-medium" data-testid="text-preventive-cost">${(preventiveCost / 1000).toFixed(0)}k</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Reactive Cost</span><span className="text-sm font-medium" data-testid="text-reactive-cost">${(reactiveCost / 1000).toFixed(0)}k</span></div></div></CardContent>
        </Card>
        <Card data-testid="card-labor-cost">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />Labor Cost Analytics</CardTitle></CardHeader>
          <CardContent><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Total Labor Cost</span><span className="text-lg font-bold text-emerald-600" data-testid="text-total-labor-cost">${totalLaborCost > 0 ? (totalLaborCost / 1000).toFixed(1) : "0"}k</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Avg Rate/Hour</span><span className="text-sm font-medium" data-testid="text-avg-labor-rate">${avgLaborCostPerHour.toFixed(2)}</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Total Hours</span><span className="text-sm font-medium" data-testid="text-total-labor-hours">{totalLaborHours.toFixed(1)}h</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Pending Hours</span><span className="text-sm font-medium" data-testid="text-pending-labor-hours">{pendingLaborHours.toFixed(1)}h</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Est. Pending Cost</span><span className="text-sm font-medium text-amber-600" data-testid="text-pending-labor-cost">${estimatedPendingLaborCost > 0 ? (estimatedPendingLaborCost / 1000).toFixed(1) : "0"}k</span></div><p className="text-xs text-muted-foreground mt-2"><span data-testid="text-work-orders-with-labor">{workOrdersWithLabor}</span> work orders with labor tracked</p></div></CardContent>
        </Card>
      </div>

      {roiTrendData.length > 0 && (
        <Card data-testid="card-roi-trend">
          <CardHeader><CardTitle>ROI Trend Analysis</CardTitle><p className="text-sm text-muted-foreground">6-month return on investment trend</p></CardHeader>
          <CardContent><div data-testid="chart-roi-trend"><ResponsiveContainer width="100%" height={250}><BarChart data={roiTrendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="roi" fill="#8b5cf6" name="ROI %" /></BarChart></ResponsiveContainer></div></CardContent>
        </Card>
      )}

      <Card data-testid="card-cost-trends">
        <CardHeader><CardTitle>Cost Trends</CardTitle><p className="text-sm text-muted-foreground">Monthly maintenance costs breakdown</p></CardHeader>
        <CardContent>
          {costTrendsData.length > 0 ? (
            <div data-testid="chart-cost-trends"><ResponsiveContainer width="100%" height={300}><LineChart data={costTrendsData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="totalCost" stroke="#3b82f6" name="Total Cost" strokeWidth={2} /><Line type="monotone" dataKey="labor" stroke="#10b981" name="Labor" /><Line type="monotone" dataKey="parts" stroke="#f59e0b" name="Parts" /><Line type="monotone" dataKey="downtime" stroke="#ef4444" name="Downtime" /></LineChart></ResponsiveContainer></div>
          ) : <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-cost-data">No cost trend data available</p>}
        </CardContent>
      </Card>

      <CollapsibleSection title="Cost Breakdown by Type" summary={`${costBreakdownData.length} cost categories tracked`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {costBreakdownData.length > 0 && <ResponsiveContainer width="100%" height={250}><RechartsPieChart><Pie data={costBreakdownData} cx="50%" cy="50%" labelLine={false} label={(entry) => `${entry.name}: $${(entry.value / 1000).toFixed(0)}k`} outerRadius={80} fill="#8884d8" dataKey="value">{costBreakdownData.map((entry) => <Cell key={`cell-${entry.name}`} fill={COLORS[costBreakdownData.indexOf(entry) % COLORS.length]} />)}</Pie><Tooltip /></RechartsPieChart></ResponsiveContainer>}
          <div className="space-y-2">{costBreakdownData.map((item: { name: string; value: number }) => <div key={item.name} className="flex items-center justify-between p-3 border rounded-lg"><div className="flex items-center gap-3"><div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS[costBreakdownData.indexOf(item) % COLORS.length] }} /><span className="font-medium capitalize">{item.name}</span></div><span className="font-bold">${(item.value / 1000).toFixed(1)}k</span></div>)}</div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Cost Optimization Opportunities" summary="Data-driven recommendations to reduce maintenance costs">
        <div className="space-y-3">
          {preventiveRatio < 40 && <div className="p-4 border rounded-lg bg-blue-500/5"><div className="flex items-start gap-3"><Target className="h-5 w-5 text-blue-600 mt-0.5" /><div><h4 className="font-semibold text-sm">Shift to Preventive Maintenance</h4><p className="text-sm text-muted-foreground mt-1">Your preventive ratio is {preventiveRatio.toFixed(0)}%. Increasing to 60% could save ${((reactiveCost * 0.3) / 1000).toFixed(0)}k/year by preventing costly failures</p></div></div></div>}
          {projectedDowntimeCost > 10000 && <div className="p-4 border rounded-lg bg-amber-500/5"><div className="flex items-start gap-3"><TrendingDown className="h-5 w-5 text-amber-600 mt-0.5" /><div><h4 className="font-semibold text-sm">Reduce Projected Downtime</h4><p className="text-sm text-muted-foreground mt-1">${(projectedDowntimeCost / 1000).toFixed(0)}k in downtime costs projected. Act on {openWorkOrders.length} open work orders earlier to reduce impact</p></div></div></div>}
        </div>
      </CollapsibleSection>
    </div>
  );
}

```

### `client/src/components/analytics/MaintenanceMode.tsx` (53 lines)

```tsx
import { TrendingUp, Clock, Target, DollarSign, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScenarioBanner } from "./ScenarioBanner";
import { CollapsibleSection } from "./CollapsibleSection";
import { ContextHelp } from "./ContextHelp";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { useMaintenanceModeData } from "@/features/analytics";
import { formatNumber } from "@/lib/formatters";

export function MaintenanceMode() {
  const { maintenanceRecords, openOrders, overdueOrders, highRiskEquipment, avgCompletionTimeHours, completionRate, completedOrders, preventiveSavings, totalFailures, totalPrevented, preventionRate, failureChartData, schedulingSuggestions, overdueWorkOrders, highRiskPdmScores, highReactiveCostEquipment } = useMaintenanceModeData();

  return (
    <div className="space-y-6">
      <ScenarioBanner type="info" title="Maintenance Mode - Predictive & Preventive" description="Track work orders, monitor predictive maintenance scores, analyze failure patterns, and optimize maintenance schedules. Use this view to plan and execute maintenance strategies." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card data-testid="card-open-orders"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Open Work Orders</CardTitle><ContextHelp title="Open Work Orders" description="Work orders that are currently in progress or pending. Track these to ensure timely completion." /></div></CardHeader><CardContent><div className="text-3xl font-bold" data-testid="text-open-orders">{openOrders}</div>{overdueOrders > 0 && <Badge variant="destructive" className="mt-2" data-testid="badge-overdue-orders">{overdueOrders} overdue</Badge>}</CardContent></Card>
        <Card data-testid="card-high-risk"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">High Risk Equipment</CardTitle><ContextHelp title="High Risk Equipment" description="Equipment with failure risk above 70%. Priority candidates for predictive maintenance interventions." /></div></CardHeader><CardContent><div className="text-3xl font-bold text-amber-600" data-testid="text-high-risk">{highRiskEquipment}</div></CardContent></Card>
        <Card data-testid="card-maintenance-records"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Maintenance Records</CardTitle><ContextHelp title="Maintenance Records" description="Historical maintenance activities tracked in the system. Used for trend analysis and compliance reporting." /></div></CardHeader><CardContent><div className="text-3xl font-bold" data-testid="text-records-count">{maintenanceRecords.length}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-completion-analytics"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" />Completion Analytics</CardTitle></CardHeader>
          <CardContent><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Completion Rate</span><span className="text-lg font-bold" data-testid="text-completion-rate">{completionRate.toFixed(0)}%</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Avg Time to Complete</span><span className="text-sm font-medium" data-testid="text-avg-completion-time">{avgCompletionTimeHours > 24 ? `${(avgCompletionTimeHours / 24).toFixed(1)} days` : `${avgCompletionTimeHours.toFixed(0)} hours`}</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Completed Orders</span><Badge variant="default" className="min-w-[3rem] justify-center" data-testid="badge-completed-orders">{completedOrders.length}</Badge></div></div></CardContent>
        </Card>
        <Card data-testid="card-prevention-effectiveness"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Prevention Effectiveness</CardTitle></CardHeader>
          <CardContent><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Prevention Rate</span><span className="text-lg font-bold text-green-600" data-testid="text-prevention-rate">{preventionRate.toFixed(0)}%</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Failures Prevented</span><Badge variant="default" className="min-w-[3rem] justify-center bg-green-600" data-testid="badge-prevented">{totalPrevented}</Badge></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Total Failures</span><Badge variant="outline" className="min-w-[3rem] justify-center" data-testid="badge-total-failures">{totalFailures}</Badge></div></div></CardContent>
        </Card>
        {highReactiveCostEquipment.length > 0 && <Card className="border-amber-500" data-testid="card-cost-optimization"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2 text-amber-600"><DollarSign className="h-4 w-4" />Cost Optimization Opportunity</CardTitle></CardHeader><CardContent><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Under-Maintained Units</span><span className="text-lg font-bold text-amber-600" data-testid="text-undermaintained">{highReactiveCostEquipment.length}</span></div><p className="text-xs text-muted-foreground" data-testid="text-optimization-description">Equipment below 60% health - shift to preventive maintenance to reduce reactive costs</p><div className="mt-2"><span className="text-xs font-medium" data-testid="text-est-savings">Est. Savings: ${formatNumber(preventiveSavings)}</span></div></div></CardContent></Card>}
        {schedulingSuggestions.length > 0 && <Card className="border-blue-500" data-testid="card-scheduling-recommendations"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2 text-blue-600"><Calendar className="h-4 w-4" />Scheduling Recommendations</CardTitle></CardHeader><CardContent><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Equipment Needing Scheduling</span><span className="text-lg font-bold text-blue-600" data-testid="text-scheduling-count">{schedulingSuggestions.length}</span></div><p className="text-xs text-muted-foreground">Equipment in optimal maintenance window (50-90% risk)</p></div></CardContent></Card>}
      </div>

      {overdueOrders > 0 && <Card className="border-destructive"><CardHeader><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-destructive" /><CardTitle>Overdue Work Orders</CardTitle></div></CardHeader><CardContent><div className="space-y-2">{overdueWorkOrders.map((wo) => <div key={wo.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`overdue-order-${wo.id}`}><div><p className="font-medium text-sm">{wo.reason || "Maintenance Required"}</p><p className="text-xs text-muted-foreground">Created {wo.createdAt ? formatDistanceToNow(new Date(wo.createdAt), { addSuffix: true }) : "recently"}</p></div><Badge variant="destructive">OVERDUE</Badge></div>)}</div></CardContent></Card>}

      {schedulingSuggestions.length > 0 && <CollapsibleSection title="Optimal Maintenance Windows" badge={`${schedulingSuggestions.length} recommended`} summary={`${schedulingSuggestions.length} equipment units in optimal maintenance window`}><div className="space-y-2">{schedulingSuggestions.slice(0, 10).map((suggestion) => <div key={suggestion.equipmentId} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`scheduling-suggestion-${suggestion.equipmentId}`}><div className="flex-1"><p className="font-medium text-sm">{suggestion.equipmentName}</p><p className="text-xs text-muted-foreground">Risk: {suggestion.failureRisk.toFixed(0)}% | Recommended window: {suggestion.recommendedWindow}</p></div><Badge variant={suggestion.priority === "High" ? "destructive" : suggestion.priority === "Medium" ? "default" : "secondary"}>{suggestion.priority}</Badge></div>)}</div></CollapsibleSection>}

      <CollapsibleSection title="Predictive Maintenance - High Risk Equipment" badge={highRiskEquipment > 0 ? `${highRiskEquipment} items` : undefined} summary={`${highRiskEquipment} equipment items with failure risk >70%`}>
        {highRiskEquipment === 0 ? <p className="text-sm text-muted-foreground">No high-risk equipment detected</p> : <div className="space-y-2">{highRiskPdmScores.map((score) => <div key={score.equipmentId} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`high-risk-equipment-${score.equipmentId}`}><div className="flex-1"><p className="font-medium text-sm">{score.equipmentName || score.equipmentId}</p><p className="text-xs text-muted-foreground">Failure Risk: {score.failureRisk.toFixed(0)}% | Confidence: {(score.confidence * 100).toFixed(0)}%</p></div><Badge variant={score.failureRisk > 85 ? "destructive" : "default"}>{score.failureRisk.toFixed(0)}% risk</Badge></div>)}</div>}
      </CollapsibleSection>

      <CollapsibleSection title="Failure Pattern Analysis" summary="Historical failure trends and prevention metrics">
        {failureChartData.length > 0 ? <ResponsiveContainer width="100%" height={300}><BarChart data={failureChartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="failures" fill="#ef4444" name="Failures" /><Bar dataKey="prevented" fill="#10b981" name="Prevented" /></BarChart></ResponsiveContainer> : <p className="text-sm text-muted-foreground">No failure pattern data available</p>}
      </CollapsibleSection>

      <CollapsibleSection title="Recent Maintenance Activity" summary={`${maintenanceRecords.slice(0, 10).length} recent records`}>
        <div className="space-y-2">{maintenanceRecords.slice(0, 10).map((record) => <div key={record.id || `${record.equipmentId}-${record.type}-${record.completedAt}`} className="flex items-center justify-between p-3 border rounded-lg text-sm"><div><p className="font-medium">{record.equipmentName || record.equipmentId}</p><p className="text-xs text-muted-foreground">{record.type}</p></div><Badge variant="outline">{record.completedAt ? formatDistanceToNow(new Date(record.completedAt), { addSuffix: true }) : "N/A"}</Badge></div>)}</div>
      </CollapsibleSection>
    </div>
  );
}

```

### `client/src/components/analytics/MissionOverview.tsx` (64 lines)

```tsx
import { AlertTriangle, TrendingUp, DollarSign, Wrench, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { PriorityAlert } from "@/lib/analytics-priority";
import { ScenarioBanner } from "./ScenarioBanner";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { formatDate, formatNumber } from "@/lib/formatters";
import { EquipmentHealthChart } from "@/components/charts/EquipmentHealthChart";
import { useMissionOverviewData } from "@/features/analytics";

export function MissionOverview() {
  const { equipmentHealth, equipmentHealthLoading, equipmentHealthError, topAlerts, anomalySeverityCounts, avgConfidence, highConfidencePredictions, lowConfidencePredictions, costSpike, hasCostSpike, degradingEquipment, criticalHealth, criticalCount, warningCount, totalFinancialImpact, getSeverityColor, exportPDFSections, exportAlertsData } = useMissionOverviewData();

  const getTypeIcon = (type: string) => { switch (type) { case "equipment": return Activity; case "anomaly": return TrendingUp; case "cost": return DollarSign; case "maintenance": return Wrench; default: return AlertTriangle; } };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold">Mission Control</h2><p className="text-sm text-muted-foreground mt-1">Auto-prioritized critical alerts and analytics</p></div>
        <ExportButton data={exportAlertsData} filename="mission-overview" formats={["csv", "pdf"]} pdfSections={exportPDFSections} csvOptions={{ columns: ["severity", "type", "message", "financialImpact", "timestamp"], headers: { severity: "Severity", type: "Type", message: "Message", financialImpact: "Financial Impact", timestamp: "Timestamp" } }} pdfOptions={{ title: "Mission Overview Report", subtitle: `Generated on ${formatDate(new Date())}` }} variant="outline" size="default" data-testid="button-export-mission" />
      </div>

      <ScenarioBanner type="guidance" title="Mission Control - Priority Dashboard" description="This view shows auto-prioritized alerts based on severity, freshness, and financial impact. Focus on critical items first, then work your way down the list." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card data-testid="card-critical-alerts"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Critical Alerts</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-destructive" data-testid="text-critical-count">{criticalCount}</div><p className="text-xs text-muted-foreground mt-1">Require immediate attention</p></CardContent></Card>
        <Card data-testid="card-warnings"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Warnings</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-amber-600" data-testid="text-warning-count">{warningCount}</div><p className="text-xs text-muted-foreground mt-1">Need attention soon</p></CardContent></Card>
        <Card data-testid="card-financial-impact"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Potential Impact</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold" data-testid="text-financial-impact">${(totalFinancialImpact / 1000).toFixed(0)}k</div><p className="text-xs text-muted-foreground mt-1">Estimated cost at risk</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-anomaly-intelligence"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Anomaly Intelligence (24h)</CardTitle></CardHeader>
          <CardContent><div className="space-y-2"><div className="flex justify-between items-center" data-testid="anomaly-critical"><span className="text-sm text-muted-foreground">Critical</span><Badge variant="destructive" className="min-w-[3rem] justify-center" data-testid="badge-anomaly-critical">{anomalySeverityCounts.critical}</Badge></div><div className="flex justify-between items-center" data-testid="anomaly-high"><span className="text-sm text-muted-foreground">High</span><Badge variant="default" className="min-w-[3rem] justify-center" data-testid="badge-anomaly-high">{anomalySeverityCounts.high}</Badge></div><div className="flex justify-between items-center" data-testid="anomaly-medium-low"><span className="text-sm text-muted-foreground">Medium/Low</span><Badge variant="secondary" className="min-w-[3rem] justify-center" data-testid="badge-anomaly-medium-low">{anomalySeverityCounts.medium + anomalySeverityCounts.low}</Badge></div></div></CardContent>
        </Card>
        <Card data-testid="card-prediction-confidence"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Prediction Confidence</CardTitle></CardHeader>
          <CardContent><div className="space-y-2"><div className="flex justify-between items-center" data-testid="metric-model-accuracy"><span className="text-sm text-muted-foreground">Model Accuracy</span><span className="text-lg font-bold" data-testid="text-model-accuracy">{(avgConfidence * 100).toFixed(1)}%</span></div><div className="flex justify-between items-center" data-testid="metric-high-confidence"><span className="text-sm text-muted-foreground">High Confidence</span><Badge variant="default" className="min-w-[3rem] justify-center" data-testid="badge-high-confidence">{highConfidencePredictions}</Badge></div>{lowConfidencePredictions > 0 && <div className="flex justify-between items-center" data-testid="metric-low-confidence"><span className="text-sm text-amber-600">Low Confidence</span><Badge variant="outline" className="min-w-[3rem] justify-center border-amber-600 text-amber-600" data-testid="badge-low-confidence">{lowConfidencePredictions}</Badge></div>}</div></CardContent>
        </Card>
        {hasCostSpike && <Card className="border-amber-500" data-testid="card-cost-spike"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2 text-amber-600"><DollarSign className="h-4 w-4" />Cost Spike Detected</CardTitle></CardHeader><CardContent><div className="space-y-2"><div className="flex justify-between items-center" data-testid="metric-cost-spike"><span className="text-sm text-muted-foreground">Recent Increase</span><span className="text-lg font-bold text-amber-600" data-testid="text-cost-spike">+{costSpike.toFixed(1)}%</span></div><p className="text-xs text-muted-foreground" data-testid="text-cost-spike-description">Recent costs are {costSpike.toFixed(0)}% higher than historical average</p><Link href="/analytics?tab=finance"><Button size="sm" variant="outline" className="w-full mt-2" data-testid="button-analyze-trends">Analyze Trends →</Button></Link></div></CardContent></Card>}
        {degradingEquipment.length > 0 && <Card className="border-destructive" data-testid="card-health-degradation"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2 text-destructive"><Wrench className="h-4 w-4" />Health Degradation Alert</CardTitle></CardHeader><CardContent><div className="space-y-2"><div className="flex justify-between items-center" data-testid="metric-degrading-units"><span className="text-sm text-muted-foreground">Degrading Units</span><span className="text-lg font-bold text-destructive" data-testid="text-degrading-count">{degradingEquipment.length}</span></div><div className="flex justify-between items-center" data-testid="metric-critical-health"><span className="text-sm text-muted-foreground">Critical Health</span><Badge variant="destructive" className="min-w-[3rem] justify-center" data-testid="badge-critical-health">{criticalHealth}</Badge></div><Link href="/equipment"><Button size="sm" variant="outline" className="w-full mt-2" data-testid="button-view-equipment">View Equipment →</Button></Link></div></CardContent></Card>}
      </div>

      <EquipmentHealthChart equipment={equipmentHealth} isLoading={equipmentHealthLoading} error={equipmentHealthError instanceof Error ? equipmentHealthError.message : null} data-testid="chart-fleet-health" />

      <Card data-testid="card-priority-alerts"><CardHeader><CardTitle>Priority Alerts</CardTitle><p className="text-sm text-muted-foreground">Sorted by priority score (severity × freshness × financial impact)</p></CardHeader>
        <CardContent>
          {topAlerts.length === 0 ? <div className="text-center py-12 text-muted-foreground" data-testid="no-alerts-message"><Activity className="h-12 w-12 mx-auto mb-3 opacity-50" /><p className="text-lg font-medium">All Systems Nominal</p><p className="text-sm mt-1">No critical alerts or warnings at this time</p></div> : (
            <div className="space-y-3" data-testid="list-priority-alerts">
              {topAlerts.map((alert: PriorityAlert) => { const Icon = getTypeIcon(alert.type); return (
                <div key={alert.id} className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors" data-testid={`item-alert-${alert.id}`}>
                  <div className={`p-2 rounded-full ${alert.severity === "critical" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"}`} data-testid={`icon-alert-${alert.id}`}><Icon className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1"><h4 className="font-semibold text-sm" data-testid={`text-alert-title-${alert.id}`}>{alert.title}</h4><Badge variant={getSeverityColor(alert.severity)} className="text-xs" data-testid={`badge-alert-severity-${alert.id}`}>{alert.severity}</Badge><Badge variant="outline" className="text-xs" data-testid={`badge-alert-score-${alert.id}`}>Score: {alert.priorityScore}</Badge></div><p className="text-sm text-muted-foreground" data-testid={`text-alert-description-${alert.id}`}>{alert.description}</p><div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground"><span data-testid={`text-alert-time-${alert.id}`}>{alert.timestamp && !Number.isNaN(new Date(alert.timestamp).getTime()) ? formatDistanceToNow(alert.timestamp, { addSuffix: true }) : "Recently"}</span>{alert.financialImpact && <span className="text-destructive font-medium" data-testid={`text-alert-impact-${alert.id}`}>~${formatNumber(alert.financialImpact)} at risk</span>}</div></div>
                  {alert.actionUrl && <Link href={alert.actionUrl}><Button size="sm" variant="ghost" data-testid={`button-alert-action-${alert.id}`}>View →</Button></Link>}
                </div>
              ); })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

```

### `client/src/components/analytics/NarrativeSummaryCard.tsx` (218 lines)

```tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, CheckCircle, Info, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";

interface NarrativeSummaryCardProps {
  vesselId: string;
  vesselName: string;
  chartType: "power_stw" | "load_distribution" | "fuel_consumption" | "efficiency";
  currentMetrics: {
    avgPower?: number;
    avgSpeed?: number;
    avgLoad?: number;
    avgFuelRate?: number;
    efficiency?: number;
  };
  baseline?: {
    value: number;
    percentageDiff: number;
  };
  fleetAverage?: {
    value: number;
    percentageDiff: number;
  };
  operatingMode?: string;
  periodDays?: number;
}

interface NarrativeSummary {
  headline: string;
  analysis: string;
  context: string[];
  recommendations: string[];
  severity: "good" | "normal" | "attention" | "critical";
  confidence: number;
}

export function NarrativeSummaryCard({
  vesselId,
  vesselName,
  chartType,
  currentMetrics,
  baseline,
  fleetAverage,
  operatingMode,
  periodDays = 30,
}: NarrativeSummaryCardProps) {
  const {
    data: summary,
    isLoading,
    error,
  } = useQuery<NarrativeSummary>({
    queryKey: ["/api/analytics/narrative-summary", vesselId, chartType, periodDays],
    queryFn: async () => {
      return apiRequest("POST", "/api/analytics/narrative-summary", {
        body: JSON.stringify({
          vesselId,
          vesselName,
          chartType,
          currentMetrics,
          baseline,
          fleetAverage,
          operatingMode,
          periodDays,
        }),
      });
    },
    refetchInterval: 300000,
    staleTime: 120000,
    enabled: !!vesselId && !!chartType,
  });

  if (isLoading) {
    return (
      <Card
        className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-gray-950"
        data-testid="card-narrative-loading"
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-lg">AI Performance Insights</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-full" data-testid="skeleton-headline" />
          <Skeleton className="h-4 w-3/4" data-testid="skeleton-analysis" />
          <Skeleton className="h-4 w-full" data-testid="skeleton-context" />
        </CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    return (
      <Card className="border-amber-200 dark:border-amber-800" data-testid="card-narrative-error">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-lg">Performance Summary</CardTitle>
          </div>
          <CardDescription data-testid="text-error-description">
            AI insights temporarily unavailable
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getSeverityIcon = () => {
    switch (summary.severity) {
      case "good":
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case "attention":
        return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      case "critical":
        return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      default:
        return <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getSeverityColor = (): string => {
    switch (summary.severity) {
      case "good":
        return "from-green-50 to-white dark:from-green-950/20 dark:to-gray-950 border-green-200 dark:border-green-800";
      case "attention":
        return "from-amber-50 to-white dark:from-amber-950/20 dark:to-gray-950 border-amber-200 dark:border-amber-800";
      case "critical":
        return "from-red-50 to-white dark:from-red-950/20 dark:to-gray-950 border-red-200 dark:border-red-800";
      default:
        return "from-blue-50 to-white dark:from-blue-950/20 dark:to-gray-950 border-blue-200 dark:border-blue-800";
    }
  };

  const confidencePercent = Math.round(summary.confidence * 100);

  return (
    <Card className={`bg-gradient-to-br ${getSeverityColor()}`} data-testid="card-narrative">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span data-testid={`icon-severity-${summary.severity}`}>{getSeverityIcon()}</span>
            <div>
              <CardTitle className="text-lg" data-testid="text-headline">
                {summary.headline}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Sparkles className="h-3 w-3" />
                AI Analysis
                {confidencePercent < 70 && (
                  <Badge variant="outline" className="text-xs" data-testid="badge-confidence">
                    {confidencePercent}% confidence
                  </Badge>
                )}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.analysis && (
          <div className="text-sm text-gray-700 dark:text-gray-300" data-testid="text-analysis">
            {summary.analysis}
          </div>
        )}

        {summary.context && summary.context.length > 0 && (
          <div className="space-y-2" data-testid="container-context">
            <h4
              className="text-sm font-semibold text-gray-900 dark:text-gray-100"
              data-testid="heading-context"
            >
              Context
            </h4>
            <ul className="space-y-1">
              {summary.context.map((item, index) => (
                <li
                  key={`context-${item.slice(0, 30)}-${index}`}
                  className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                  data-testid={`item-context-${index}`}
                >
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.recommendations && summary.recommendations.length > 0 && (
          <div className="space-y-2" data-testid="container-recommendations">
            <h4
              className="text-sm font-semibold text-gray-900 dark:text-gray-100"
              data-testid="heading-recommendations"
            >
              Recommendations
            </h4>
            <ul className="space-y-1">
              {summary.recommendations.map((rec, index) => (
                <li
                  key={`rec-${rec.slice(0, 30)}-${index}`}
                  className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                  data-testid={`item-recommendation-${index}`}
                >
                  <span className="text-blue-500 mt-0.5">→</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

```

### `client/src/components/analytics/OperationsMode.tsx` (144 lines)

```tsx
import { useState, useCallback } from "react";
import { Wifi, WifiOff, AlertTriangle, Check, TrendingUp, Brain, LineChart as LineChartIcon, RefreshCw } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScenarioBanner } from "./ScenarioBanner";
import { CollapsibleSection } from "./CollapsibleSection";
import { ContextHelp } from "./ContextHelp";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { useOperationsModeData } from "@/features/analytics";
import { useTelemetryStreams, SensorSparklineChart } from "@/features/telemetry";
import { useQuery } from "@tanstack/react-query";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

export function OperationsMode() {
  const [, navigate] = useLocation();
  const [selectedVessel, setSelectedVessel] = useState<string>("all");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");

  const { isConnected, latestTelemetry, failurePredictions, criticalEquipment, warningEquipment, healthyEquipment, driftingSensors, highConfidencePredictions, avgPredictionConfidence, equipmentHealthTrends, unacknowledgedAnomalies, acknowledgedAnomalies, handleAcknowledge } = useOperationsModeData();

  const { data: vessels = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/vessels"],
  });

  const { data: equipment = [] } = useQuery<Array<{ id: string; name: string; vesselId: string }>>({
    queryKey: ["/api/equipment"],
  });

  const filteredEquipment = selectedVessel === "all" 
    ? equipment 
    : equipment.filter((e) => e.vesselId === selectedVessel);

  const [telemetrySectionRef, isTelemetrySectionVisible] = useIntersectionObserver<HTMLDivElement>({
    rootMargin: "100px",
    triggerOnce: true,
  });

  const { streams, isLoading: streamsLoading, refetch: refetchStreams } = useTelemetryStreams({
    vesselId: selectedVessel === "all" ? undefined : selectedVessel,
    equipmentId: selectedEquipment === "all" ? undefined : selectedEquipment,
    hours: 1,
    refreshInterval: 30000,
    enabled: isTelemetrySectionVisible,
  });

  const handleViewDetails = useCallback((equipmentId: string, sensorType: string) => {
    navigate(`/active-telemetry?equipment=${equipmentId}&sensor=${sensorType}`);
  }, [navigate]);

  return (
    <div className="space-y-6">
      <ScenarioBanner type="info" title="Operations Mode - Real-Time Monitoring" description="Monitor live equipment health, telemetry streams, and operational anomalies. Use this view for day-to-day fleet oversight and rapid response to issues." />

      <Card data-testid="card-connection-status"><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">Live Connection Status</CardTitle><div className="flex items-center gap-2" data-testid="connection-indicator">{isConnected ? <><Wifi className="h-4 w-4 text-green-500" data-testid="icon-connected" /><span className="text-sm text-green-500" data-testid="status-connection">Connected</span></> : <><WifiOff className="h-4 w-4 text-red-500" data-testid="icon-disconnected" /><span className="text-sm text-red-500" data-testid="status-connection">Disconnected</span></>}</div></div></CardHeader><CardContent>{latestTelemetry && <div className="text-sm" data-testid="latest-telemetry"><p className="text-muted-foreground" data-testid="text-latest-reading">Latest: {latestTelemetry.sensorType} = {latestTelemetry.value}{latestTelemetry.unit} ({formatDistanceToNow(new Date(latestTelemetry.timestamp), { addSuffix: true })})</p></div>}</CardContent></Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-prediction-status"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4" />AI Prediction Status</CardTitle></CardHeader><CardContent><div className="space-y-2"><div className="flex justify-between items-center" data-testid="metric-avg-confidence"><span className="text-sm text-muted-foreground">Avg Confidence</span><span className="text-lg font-bold" data-testid="text-avg-confidence">{(avgPredictionConfidence * 100).toFixed(1)}%</span></div><div className="flex justify-between items-center" data-testid="metric-high-confidence"><span className="text-sm text-muted-foreground">High Confidence</span><Badge variant="default" className="min-w-[3rem] justify-center" data-testid="badge-high-confidence">{highConfidencePredictions.length}</Badge></div><div className="flex justify-between items-center" data-testid="metric-active-predictions"><span className="text-sm text-muted-foreground">Active Predictions</span><Badge variant="outline" className="min-w-[3rem] justify-center" data-testid="badge-active-predictions">{failurePredictions.length}</Badge></div></div></CardContent></Card>
        {driftingSensors.length > 0 && <Card className="border-amber-500" data-testid="card-telemetry-drift"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2 text-amber-600"><TrendingUp className="h-4 w-4" />Telemetry Drift Detected</CardTitle></CardHeader><CardContent><div className="space-y-2"><div className="flex justify-between items-center" data-testid="metric-drifting-sensors"><span className="text-sm text-muted-foreground">Drifting Sensors</span><span className="text-lg font-bold text-amber-600" data-testid="text-drifting-sensors">{driftingSensors.length}</span></div><p className="text-xs text-muted-foreground" data-testid="text-drift-description">Sensor values deviating &gt;15% from baseline - review calibration</p><div className="mt-2 space-y-1" data-testid="list-drifting-sensors">{driftingSensors.slice(0, 3).map((sensor, idx) => <div key={`drift-${sensor.equipmentId}-${sensor.sensorType}`} className="text-xs" data-testid={`item-drift-${idx}`}><span className="font-medium" data-testid={`text-drift-sensor-${idx}`}>{sensor.sensorType}</span><span className="text-muted-foreground"> on {sensor.equipmentId}</span></div>)}</div></div></CardContent></Card>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-red-500/50" data-testid="card-critical-equipment"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Critical</CardTitle><ContextHelp title="Critical Equipment" description="Equipment with health index below 30%. Requires immediate attention to prevent failures." /></div></CardHeader><CardContent><div className="text-3xl font-bold text-destructive" data-testid="text-critical-count">{criticalEquipment.length}</div></CardContent></Card>
        <Card className="border-amber-500/50" data-testid="card-warning-equipment"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Warning</CardTitle><ContextHelp title="Warning Equipment" description="Equipment with health index 30-49%. Schedule maintenance soon to prevent degradation." /></div></CardHeader><CardContent><div className="text-3xl font-bold text-amber-600" data-testid="text-warning-count">{warningEquipment.length}</div></CardContent></Card>
        <Card className="border-green-500/50" data-testid="card-healthy-equipment"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Healthy</CardTitle><ContextHelp title="Healthy Equipment" description="Equipment with health index 75%+. Operating within normal parameters." /></div></CardHeader><CardContent><div className="text-3xl font-bold text-green-600" data-testid="text-healthy-count">{healthyEquipment.length}</div></CardContent></Card>
      </div>

      {criticalEquipment.length > 0 && <Card className="border-destructive" data-testid="card-critical-list"><CardHeader><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /><CardTitle>Critical Equipment Requiring Attention</CardTitle></div></CardHeader><CardContent><div className="space-y-2" data-testid="list-critical-equipment">{criticalEquipment.map((eq) => <div key={eq.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`item-critical-equipment-${eq.id}`}><div><p className="font-medium" data-testid={`text-equipment-name-${eq.id}`}>{eq.name || eq.id}</p><p className="text-sm text-muted-foreground" data-testid={`text-equipment-metrics-${eq.id}`}>Health: {eq.healthIndex}% | Failure Risk: {eq.failureRisk}%</p></div><Badge variant="destructive" data-testid={`badge-critical-${eq.id}`}>CRITICAL</Badge></div>)}</div></CardContent></Card>}

      <CollapsibleSection title="Recent Anomalies" badge={unacknowledgedAnomalies.length > 0 ? `${unacknowledgedAnomalies.length} unacknowledged` : undefined} summary={unacknowledgedAnomalies.length > 0 ? `${unacknowledgedAnomalies.length} anomalies require acknowledgment` : "No unacknowledged anomalies"}>
        {unacknowledgedAnomalies.length === 0 ? <p className="text-sm text-muted-foreground">No unacknowledged anomalies. {acknowledgedAnomalies.size > 0 && `${acknowledgedAnomalies.size} acknowledged this session.`}</p> : <div className="space-y-2">{unacknowledgedAnomalies.slice(0, 8).map((anomaly, idx) => { const anomalyId = anomaly.id || `${anomaly.equipmentId}-${anomaly.timestamp}`; return <div key={anomalyId} className="flex items-center justify-between gap-3 p-3 border rounded-lg" data-testid={`item-anomaly-${idx}`}><div className="flex-1 min-w-0"><p className="font-medium text-sm" data-testid={`text-anomaly-equipment-${idx}`}>{anomaly.equipmentName || anomaly.equipmentId}</p><p className="text-xs text-muted-foreground" data-testid={`text-anomaly-details-${idx}`}>{anomaly.sensorType}: {anomaly.value}{anomaly.unit} ({anomaly.zscore?.toFixed(1)}σ deviation)</p><Badge variant="outline" className="mt-1 text-xs" data-testid={`badge-anomaly-time-${idx}`}>{formatDistanceToNow(new Date(anomaly.timestamp), { addSuffix: true })}</Badge></div><div className="flex gap-2"><Link href={`/active-telemetry?equipment=${anomaly.equipmentId}&sensor=${anomaly.sensorType}`}><Button size="sm" variant="outline" data-testid={`button-view-graph-${idx}`}><LineChartIcon className="h-3 w-3 mr-1" />Graph</Button></Link><Button size="sm" variant="outline" onClick={() => handleAcknowledge(anomalyId)} data-testid={`button-acknowledge-anomaly-${idx}`}><Check className="h-3 w-3 mr-1" />Ack</Button></div></div>; })}</div>}
      </CollapsibleSection>

      {equipmentHealthTrends.length > 0 && <CollapsibleSection title="Equipment Health Trends" summary={`Showing trends for ${equipmentHealthTrends.slice(0, 3).length} equipment units`}><div className="space-y-6">{equipmentHealthTrends.slice(0, 3).map((eq) => <div key={eq.equipmentId} className="space-y-2" data-testid={`item-health-trend-${eq.equipmentId}`}><div className="flex items-center justify-between"><h4 className="text-sm font-medium" data-testid={`text-trend-name-${eq.equipmentId}`}>{eq.name}</h4><Badge variant={eq.currentHealth < 50 ? "destructive" : "default"} data-testid={`badge-trend-health-${eq.equipmentId}`}>{eq.currentHealth}% Health</Badge></div><div className="h-48" data-testid={`chart-health-trend-${eq.equipmentId}`}><ResponsiveContainer width="100%" height="100%"><LineChart data={eq.trendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="timestamp" tick={{ fontSize: 12 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 12 }} /><Tooltip /><Line type="monotone" dataKey="health" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div></div>)}</div></CollapsibleSection>}

      <div ref={telemetrySectionRef}>
        <CollapsibleSection title="Active Telemetry Streams" summary={`${streams.length} sensors reporting`}>
          <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedVessel} onValueChange={(v) => { setSelectedVessel(v); setSelectedEquipment("all"); }}>
              <SelectTrigger className="w-[180px]" data-testid="select-vessel">
                <SelectValue placeholder="All Vessels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels</SelectItem>
                {vessels.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
              <SelectTrigger className="w-[180px]" data-testid="select-equipment">
                <SelectValue placeholder="All Equipment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Equipment</SelectItem>
                {filteredEquipment.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => refetchStreams()} data-testid="button-refresh-streams">
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            {streams.filter((s) => s.hasAnomaly).length > 0 && (
              <Badge variant="destructive" data-testid="badge-anomaly-count">
                {streams.filter((s) => s.hasAnomaly).length} anomalies
              </Badge>
            )}
          </div>
          {streamsLoading ? (
            <div className="text-sm text-muted-foreground">Loading telemetry streams...</div>
          ) : streams.length === 0 ? (
            <div className="text-sm text-muted-foreground">No telemetry streams available. Check sensor configuration.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {streams.slice(0, 12).map((stream) => (
                <SensorSparklineChart
                  key={`${stream.equipmentId}-${stream.sensorType}`}
                  sensorType={stream.sensorType}
                  equipmentId={stream.equipmentId}
                  currentValue={stream.currentValue}
                  unit={stream.unit}
                  status={stream.status}
                  hasAnomaly={stream.hasAnomaly}
                  anomalyZScore={stream.anomalyZScore}
                  anomalyTimestamp={stream.anomalyTimestamp}
                  data={stream.data}
                  lastUpdate={stream.lastUpdate}
                  onViewDetails={() => handleViewDetails(stream.equipmentId, stream.sensorType)}
                />
              ))}
            </div>
            )}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}

```

### `client/src/components/analytics/PowerSTWChart.tsx` (196 lines)

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Ship, AlertCircle, TrendingUp, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BenchmarkLayer } from "./chart-overlays/BenchmarkLayer";
import { usePowerSTWData, type EnrichedDataPoint } from "@/features/analytics/hooks/usePowerSTWData";
import { formatNumber } from "@/lib/formatters";

interface PowerSTWChartProps {
  vesselId: string;
  startDate?: Date;
  endDate?: Date;
}

export function PowerSTWChart({ vesselId, startDate, endDate }: PowerSTWChartProps) {
  const {
    data, isLoading, isError, error, enrichedData, avgDeviation,
    speedUnit, powerUnit, toggles, setToggle, showControls, setShowControls,
  } = usePowerSTWData({ vesselId, startDate, endDate });

  if (isLoading) {
    return (
      <Card data-testid="card-power-stw-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Power vs Speed Through Water
          </CardTitle>
          <CardDescription>Propulsion efficiency and hull fouling analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" data-testid="skeleton-power-stw" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/50" data-testid="card-power-stw-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Power-STW Analysis Error
          </CardTitle>
          <CardDescription>Failed to load power-STW data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground" data-testid="text-error-message">
            {error instanceof Error ? error.message : "Unknown error occurred"}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.actual.length === 0) {
    return (
      <Card data-testid="card-power-stw-empty">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Power vs Speed Through Water
          </CardTitle>
          <CardDescription>Propulsion efficiency and hull fouling analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-80 text-center" data-testid="empty-state">
            <Ship className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground" data-testid="text-no-data">
              No RPM/torque data available for the selected period.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Power-STW analysis requires engine RPM and shaft torque sensors.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-power-stw">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Power vs Speed Through Water
            </CardTitle>
            <CardDescription>
              Propulsion efficiency analysis • {formatNumber(data.metadata.sampleCount)} samples
              {data.metadata.estimatedSTW && (
                <Badge variant="outline" className="ml-2 text-xs" data-testid="badge-speed-estimated">
                  Speed Estimated
                </Badge>
              )}
            </CardDescription>
          </div>
          <button
            onClick={() => setShowControls(!showControls)}
            className="p-2 hover:bg-accent rounded-md transition-colors"
            data-testid="button-toggle-controls"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>

        {showControls && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3" data-testid="container-chart-controls">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-center space-x-2">
                <Switch id="baseline-toggle" checked={toggles.showBaseline} onCheckedChange={(checked) => setToggle("showBaseline", checked)} data-testid="switch-baseline" />
                <Label htmlFor="baseline-toggle" className="text-sm cursor-pointer">Baseline</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="fleet-avg-toggle" checked={toggles.showFleetAverage} onCheckedChange={(checked) => setToggle("showFleetAverage", checked)} data-testid="switch-fleet-avg" />
                <Label htmlFor="fleet-avg-toggle" className="text-sm cursor-pointer">Fleet Average</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="percentiles-toggle" checked={toggles.showPercentiles} onCheckedChange={(checked) => setToggle("showPercentiles", checked)} data-testid="switch-percentiles" />
                <Label htmlFor="percentiles-toggle" className="text-sm cursor-pointer">Percentiles</Label>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart data={enrichedData} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="speed" type="number" name="Speed" unit={` ${speedUnit}`} label={{ value: `Speed Through Water (${speedUnit})`, position: "insideBottom", offset: -15 }} tick={{ fontSize: 12 }} />
            <YAxis type="number" name="Power" unit={` ${powerUnit}`} label={{ value: `Propulsion Power (${powerUnit})`, angle: -90, position: "insideLeft" }} tick={{ fontSize: 12 }} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (active && payload?.length > 0) {
                  const d = payload[0].payload as EnrichedDataPoint;
                  return (
                    <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-medium text-sm mb-2">Performance Data</p>
                      <p className="text-sm text-muted-foreground">Speed: <span className="font-mono text-foreground">{d.speed?.toFixed(1)} {speedUnit}</span></p>
                      {d.actualPower !== undefined && <p className="text-sm text-muted-foreground">Actual Power: <span className="font-mono text-foreground">{d.actualPower.toFixed(0)} {powerUnit}</span></p>}
                      {d.baselinePower !== undefined && <p className="text-sm text-muted-foreground">Baseline: <span className="font-mono text-foreground">{d.baselinePower.toFixed(0)} {powerUnit}</span></p>}
                      {d.fleetAvg !== undefined && <p className="text-sm text-muted-foreground">Fleet Avg: <span className="font-mono text-foreground">{d.fleetAvg.toFixed(0)} {powerUnit}</span></p>}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend wrapperStyle={{ paddingTop: "10px" }} iconType="circle" />
            <BenchmarkLayer data={enrichedData} showBaseline={toggles.showBaseline} showFleetAverage={toggles.showFleetAverage} showPercentiles={toggles.showPercentiles} xKey="speed" />
            <Scatter name="Actual Performance" data={enrichedData.filter((d) => d.actualPower !== undefined)} fill="hsl(var(--primary))" opacity={0.6} dataKey="actualPower" />
          </ScatterChart>
        </ResponsiveContainer>

        <div className="mt-4 p-4 bg-muted/50 rounded-lg" data-testid="container-hull-analysis">
          <h4 className="font-medium text-sm mb-2">Hull Efficiency Analysis</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Average Deviation:</p>
              <p className={`font-mono font-medium ${avgDeviation > 20 ? "text-destructive" : avgDeviation > 10 ? "text-warning" : "text-success"}`} data-testid="text-avg-deviation">
                {avgDeviation > 0 ? "+" : ""}{avgDeviation.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Status:</p>
              <Badge variant={avgDeviation > 20 ? "destructive" : avgDeviation > 10 ? "default" : "secondary"} data-testid="badge-hull-status">
                {avgDeviation > 20 ? "Hull Fouling Likely" : avgDeviation > 10 ? "Efficiency Reduced" : "Normal Performance"}
              </Badge>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            <p data-testid="text-hull-recommendation">
              {avgDeviation > 20 && "🚨 Significant power increase detected - hull cleaning recommended"}
              {avgDeviation > 10 && avgDeviation <= 20 && "⚠️ Moderate efficiency loss - monitor hull condition"}
              {avgDeviation <= 10 && "✅ Hull performance within normal range"}
            </p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
          <p>Period: {new Date(data.metadata.period.start).toLocaleDateString()} - {new Date(data.metadata.period.end).toLocaleDateString()}</p>
          <p className="mt-1">
            Vessel: <span className="font-medium text-foreground">{data.metadata.vesselName}</span>
            {data.metadata.estimatedSTW && <span className="ml-2 text-orange-600">(Speed estimated from RPM - install GPS/speed sensor for accuracy)</span>}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

```

### `client/src/components/analytics/ScenarioBanner.tsx` (46 lines)

```tsx
import { AlertCircle, Info, Lightbulb } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ScenarioBannerProps {
  type?: "info" | "guidance" | "alert";
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * ScenarioBanner component - Contextual guidance banners for different analytics modes
 */
export function ScenarioBanner({
  type = "info",
  title,
  description,
  actions,
  className = "",
}: ScenarioBannerProps) {
  const icons = {
    info: Info,
    guidance: Lightbulb,
    alert: AlertCircle,
  };

  const Icon = icons[type];

  const variants = {
    info: "border-blue-500/50 bg-blue-500/10",
    guidance: "border-amber-500/50 bg-amber-500/10",
    alert: "border-red-500/50 bg-red-500/10",
  };

  return (
    <Alert className={`${variants[type]} ${className}`} data-testid="scenario-banner">
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2">
        {description}
        {actions && <div className="mt-3">{actions}</div>}
      </AlertDescription>
    </Alert>
  );
}

```

### `client/src/components/analytics/chart-overlays/AnomalyMarkers.tsx` (72 lines)

```tsx
import { Scatter } from "recharts";

export interface AnomalyPoint {
  x: number;
  y: number;
  timestamp: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  alertId?: string;
}

interface AnomalyMarkersProps {
  anomalies: AnomalyPoint[];
  onAnomalyClick?: (anomaly: AnomalyPoint) => void;
}

/**
 * Reusable anomaly marker overlay component for charts
 * Renders clickable anomaly markers on performance charts
 */
export function AnomalyMarkers({ anomalies, onAnomalyClick }: AnomalyMarkersProps) {
  if (!anomalies || anomalies.length === 0) {return null;}

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "#ef4444"; // red-500
      case "high":
        return "#f97316"; // orange-500
      case "medium":
        return "#eab308"; // yellow-500
      case "low":
        return "#3b82f6"; // blue-500
      default:
        return "#6b7280"; // gray-500
    }
  };

  // Custom dot component for anomalies
  const CustomDot = (props: { cx?: number; cy?: number; payload?: AnomalyPoint }) => {
    const { cx, cy, payload } = props;
    if (!payload) {return null;}

    return (
      <g
        onClick={() => onAnomalyClick?.(payload)}
        style={{ cursor: onAnomalyClick ? "pointer" : "default" }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill={getSeverityColor(payload.severity)}
          stroke="#fff"
          strokeWidth={2}
          opacity={0.9}
        />
        <circle cx={cx} cy={cy} r={10} fill={getSeverityColor(payload.severity)} opacity={0.2} />
      </g>
    );
  };

  return (
    <Scatter
      data={anomalies}
      fill="#ef4444"
      shape={<CustomDot />}
      name="Anomalies"
      isAnimationActive={false}
    />
  );
}

```

### `client/src/components/analytics/chart-overlays/BenchmarkLayer.tsx` (99 lines)

```tsx
import { Line } from "recharts";

export interface BenchmarkData {
  x: number;
  fleetAvg?: number;
  p25?: number;
  p50?: number;
  p75?: number;
  baseline?: number;
}

interface BenchmarkLayerProps {
  data: BenchmarkData[];
  showBaseline?: boolean;
  showFleetAverage?: boolean;
  showPercentiles?: boolean;
  xKey?: string;
}

/**
 * Reusable benchmark overlay component for charts
 * Renders baseline, fleet average, and percentile lines
 */
export function BenchmarkLayer({
  data,
  showBaseline = false,
  showFleetAverage = false,
  showPercentiles = false,
  xKey: _xKey = "x",
}: BenchmarkLayerProps) {
  if (!data || data.length === 0) {return null;}

  return (
    <>
      {showBaseline && (
        <Line
          type="monotone"
          dataKey="baseline"
          stroke="#9333ea"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          name="Theoretical Baseline"
          isAnimationActive={false}
        />
      )}

      {showFleetAverage && (
        <Line
          type="monotone"
          dataKey="fleetAvg"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="8 4"
          dot={false}
          name="Fleet Average"
          isAnimationActive={false}
        />
      )}

      {showPercentiles && (
        <>
          <Line
            type="monotone"
            dataKey="p25"
            stroke="#10b981"
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={false}
            name="25th Percentile"
            opacity={0.6}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p50"
            stroke="#10b981"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            dot={false}
            name="50th Percentile (Median)"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p75"
            stroke="#10b981"
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={false}
            name="75th Percentile"
            opacity={0.6}
            isAnimationActive={false}
          />
        </>
      )}
    </>
  );
}

```

### `client/src/components/analytics/chart-overlays/ContextBands.tsx` (62 lines)

```tsx
import { ReferenceArea } from "recharts";

export interface ContextBand {
  start: number;
  end: number;
  type: "sea_state" | "operational_mode" | "maintenance" | "other";
  label: string;
  severity?: number;
}

interface ContextBandsProps {
  bands: ContextBand[];
  xKey?: string;
}

/**
 * Reusable context band overlay component for charts
 * Renders shaded regions for sea state, operational mode, etc.
 */
export function ContextBands({ bands, xKey: _xKey = "x" }: ContextBandsProps) {
  if (!bands || bands.length === 0) {return null;}

  const getBandColor = (type: string, severity?: number) => {
    switch (type) {
      case "sea_state":
        // Color by severity (Douglas scale 0-7)
        if (severity !== undefined) {
          if (severity <= 2) {return "#dbeafe";} // blue-100 - calm
          if (severity <= 4) {return "#fef3c7";} // yellow-100 - moderate
          if (severity <= 6) {return "#fed7aa";} // orange-100 - rough
          return "#fecaca"; // red-100 - very rough
        }
        return "#e0e7ff"; // indigo-100
      case "operational_mode":
        return "#dcfce7"; // green-100
      case "maintenance":
        return "#fef9c3"; // yellow-100
      default:
        return "#f3f4f6"; // gray-100
    }
  };

  return (
    <>
      {bands.map((band, index) => (
        <ReferenceArea
          key={`context-band-${index}`}
          x1={band.start}
          x2={band.end}
          fill={getBandColor(band.type, band.severity)}
          fillOpacity={0.3}
          label={{
            value: band.label,
            position: "insideTop",
            fontSize: 10,
            fill: "#6b7280",
          }}
        />
      ))}
    </>
  );
}

```

### `client/src/components/charts/ChartWrapper.tsx` (152 lines)

```tsx
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, BarChart3 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResponsiveContainer, ReferenceArea } from "recharts";
import { ReactElement, cloneElement, Children, isValidElement } from "react";

export interface ThresholdBand {
  min: number;
  max: number;
  label?: string;
}

interface ChartWrapperProps {
  title: string;
  description?: string;
  isLoading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  "data-testid"?: string;
  optimalRange?: ThresholdBand;
  criticalRange?: ThresholdBand;
  warningRange?: ThresholdBand;
  showBands?: boolean;
}

export function ChartWrapper({
  title,
  description,
  isLoading = false,
  error = null,
  isEmpty = false,
  emptyMessage = "No data available for this time period",
  children,
  className,
  actions,
  "data-testid": testId,
  optimalRange,
  criticalRange,
  warningRange,
  showBands = false,
}: ChartWrapperProps) {
  const enhancedChildren =
    showBands && (optimalRange || criticalRange || warningRange)
      ? Children.map(children, (child) => {
          if (!isValidElement(child)) {return child;}

          const bandElements = [];

          if (optimalRange) {
            bandElements.push(
              <ReferenceArea
                key="optimal-band"
                y1={optimalRange.min}
                y2={optimalRange.max}
                fill="hsl(142, 76%, 36%)"
                fillOpacity={0.1}
                label={optimalRange.label}
                ifOverflow="extendDomain"
              />
            );
          }

          if (warningRange) {
            bandElements.push(
              <ReferenceArea
                key="warning-band"
                y1={warningRange.min}
                y2={warningRange.max}
                fill="hsl(38, 92%, 50%)"
                fillOpacity={0.1}
                label={warningRange.label}
                ifOverflow="extendDomain"
              />
            );
          }

          if (criticalRange) {
            bandElements.push(
              <ReferenceArea
                key="critical-band"
                y1={criticalRange.min}
                y2={criticalRange.max}
                fill="hsl(0, 84%, 60%)"
                fillOpacity={0.1}
                label={criticalRange.label}
                ifOverflow="extendDomain"
              />
            );
          }

          return cloneElement(child as ReactElement, {
            children: [
              ...bandElements,
              ...(Array.isArray((child as ReactElement).props.children)
                ? (child as ReactElement).props.children
                : [(child as ReactElement).props.children]),
            ].filter(Boolean),
          });
        })
      : children;

  return (
    <Card className={className} data-testid={testId}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" data-testid={`${testId}-loading`}>
            <Skeleton className="h-[300px] w-full" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ) : error ? (
          <Alert variant="destructive" data-testid={`${testId}-error`}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : isEmpty ? (
          <div
            className="flex flex-col items-center justify-center h-[300px] text-muted-foreground"
            data-testid={`${testId}-empty`}
          >
            <BarChart3 className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            {enhancedChildren}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

```

### `client/src/components/charts/DataQualityChart.tsx` (79 lines)

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { ChartWrapper } from "./ChartWrapper";
import type { ReconciliationReport } from "@shared/analytics-types";

interface DataQualityChartProps {
  report: ReconciliationReport | null;
  isLoading?: boolean;
  error?: string | null;
  "data-testid"?: string;
}

const SEVERITY_COLORS = {
  critical: "hsl(var(--destructive))",
  warning: "hsl(var(--warning))",
  info: "hsl(var(--primary))",
};

export function DataQualityChart({
  report,
  isLoading = false,
  error = null,
  "data-testid": testId = "chart-data-quality",
}: DataQualityChartProps) {
  // Transform issues into chart data grouped by severity
  const chartData = report?.issues.length
    ? Object.entries(
        report.issues.reduce(
          (acc, issue) => {
            const key = issue.severity;
            acc[key] = (acc[key] || 0) + (issue.affectedRecords || 1);
            return acc;
          },
          {} as Record<string, number>
        )
      ).map(([severity, count]) => ({
        severity: severity.charAt(0).toUpperCase() + severity.slice(1),
        count,
        fill: SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || SEVERITY_COLORS.info,
      }))
    : [];

  const isEmpty = !chartData.length;

  return (
    <ChartWrapper
      title="Data Quality Issues by Severity"
      description="Distribution of validation issues across severity levels"
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyMessage="No data quality issues detected"
      data-testid={testId}
    >
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="severity" className="text-xs" tick={{ fill: "hsl(var(--foreground))" }} />
        <YAxis
          className="text-xs"
          tick={{ fill: "hsl(var(--foreground))" }}
          label={{ value: "Affected Records", angle: -90, position: "insideLeft" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
          }}
          labelStyle={{ color: "hsl(var(--foreground))" }}
        />
        <Legend />
        <Bar dataKey="count" name="Affected Records" radius={[8, 8, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartWrapper>
  );
}

```

### `client/src/components/charts/EquipmentHealthChart.tsx` (87 lines)

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { ChartWrapper } from "./ChartWrapper";
import type { EquipmentHealthDTO } from "@shared/analytics-types";

interface EquipmentHealthChartProps {
  equipment: EquipmentHealthDTO[];
  isLoading?: boolean;
  error?: string | null;
  "data-testid"?: string;
}

const CONDITION_COLORS = {
  excellent: "hsl(142, 71%, 45%)",
  good: "hsl(var(--chart-2))",
  fair: "hsl(var(--warning))",
  poor: "hsl(var(--chart-4))",
  critical: "hsl(var(--destructive))",
};

const CONDITION_ORDER = ["excellent", "good", "fair", "poor", "critical"] as const;

export function EquipmentHealthChart({
  equipment,
  isLoading = false,
  error = null,
  "data-testid": testId = "chart-equipment-health",
}: EquipmentHealthChartProps) {
  // Group equipment by condition
  const chartData = equipment.length
    ? CONDITION_ORDER.map((condition) => {
        const count = equipment.filter((e) => e.condition === condition).length;
        return {
          condition: condition.charAt(0).toUpperCase() + condition.slice(1),
          count,
          fill: CONDITION_COLORS[condition],
        };
      }).filter((d) => d.count > 0)
    : [];

  const isEmpty = !chartData.length;

  interface TooltipEntry { payload: { condition: string; count: number }; }
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) => {
    if (active && payload?.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.condition}</p>
          <p className="text-sm text-muted-foreground">
            {data.count} equipment {data.count === 1 ? "unit" : "units"}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ChartWrapper
      title="Fleet Health Distribution"
      description="Equipment count by health condition"
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyMessage="No equipment data available"
      data-testid={testId}
    >
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="condition" className="text-xs" tick={{ fill: "hsl(var(--foreground))" }} />
        <YAxis
          className="text-xs"
          tick={{ fill: "hsl(var(--foreground))" }}
          label={{ value: "Equipment Count", angle: -90, position: "insideLeft" }}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="count" name="Equipment Units" radius={[8, 8, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartWrapper>
  );
}

```

### `client/src/components/charts/IssueTypeChart.tsx` (94 lines)

```tsx
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { ChartWrapper } from "./ChartWrapper";
import type { ReconciliationReport } from "@shared/analytics-types";

interface IssueTypeChartProps {
  report: ReconciliationReport | null;
  isLoading?: boolean;
  error?: string | null;
  "data-testid"?: string;
}

const ISSUE_TYPE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(220, 70%, 50%)",
  "hsl(280, 70%, 50%)",
  "hsl(40, 70%, 50%)",
];

export function IssueTypeChart({
  report,
  isLoading = false,
  error = null,
  "data-testid": testId = "chart-issue-type",
}: IssueTypeChartProps) {
  // Transform issues into chart data grouped by type
  const chartData = report?.issues.length
    ? Object.entries(
        report.issues.reduce(
          (acc, issue) => {
            const key = issue.issueType || "unknown";
            acc[key] = (acc[key] || 0) + (issue.affectedRecords || 1);
            return acc;
          },
          {} as Record<string, number>
        )
      ).map(([type, count]) => ({
        name: type
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        value: count,
      }))
    : [];

  const isEmpty = !chartData.length;

  const renderLabel = (entry: { name: string; value: number; percent: number }) => {
    return `${entry.name}: ${entry.value} (${(entry.percent * 100).toFixed(0)}%)`;
  };

  return (
    <ChartWrapper
      title="Issues by Type"
      description="Breakdown of validation issues by category"
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyMessage="No issues to display"
      data-testid={testId}
    >
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderLabel}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={ISSUE_TYPE_COLORS[index % ISSUE_TYPE_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
          }}
        />
        <Legend />
      </PieChart>
    </ChartWrapper>
  );
}

```

### `client/src/components/charts/MultiSensorChart.tsx` (321 lines)

```tsx
import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartWrapper } from "./ChartWrapper";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

interface SensorDataPoint {
  timestamp: Date | string;
  value: number;
}

interface SensorData {
  sensorType: string;
  unit: string;
  color: string;
  data: SensorDataPoint[];
}

interface MultiSensorChartProps {
  sensors: SensorData[];
  title: string;
  description?: string;
  timeRange?: "1h" | "6h" | "24h" | "7d";
  onTimeRangeChange?: (range: "1h" | "6h" | "24h" | "7d") => void;
  isLoading?: boolean;
  error?: string | null;
  "data-testid"?: string;
}

const CHART_COLORS = [
  "hsl(220, 70%, 50%)",
  "hsl(142, 70%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(280, 70%, 50%)",
  "hsl(180, 70%, 45%)",
];

function mergeTimeSeriesData(sensors: SensorData[]): Record<string, number>[] {
  const merged: Record<number, Record<string, number>> = {};

  sensors.forEach((sensor) => {
    sensor.data.forEach((point) => {
      const ts =
        typeof point.timestamp === "string"
          ? new Date(point.timestamp).getTime()
          : point.timestamp.getTime();

      if (!merged[ts]) {
        merged[ts] = { timestamp: ts };
      }
      merged[ts][sensor.sensorType] = point.value;
    });
  });

  return Object.values(merged).sort((a, b) => a.timestamp - b.timestamp);
}

function getUniqueUnits(sensors: SensorData[]): string[] {
  const units = new Set<string>();
  sensors.forEach((s) => units.add(s.unit));
  return Array.from(units);
}

export function MultiSensorChart({
  sensors,
  title,
  description,
  timeRange = "24h",
  onTimeRangeChange,
  isLoading = false,
  error = null,
  "data-testid": testId = "chart-multi-sensor",
}: MultiSensorChartProps) {
  const [visibleSensors, setVisibleSensors] = useState<Set<string>>(
    new Set(sensors.map((s) => s.sensorType))
  );

  const toggleSensor = (sensorType: string) => {
    const newVisible = new Set(visibleSensors);
    if (newVisible.has(sensorType)) {
      if (newVisible.size > 1) {
        newVisible.delete(sensorType);
      }
    } else {
      newVisible.add(sensorType);
    }
    setVisibleSensors(newVisible);
  };

  const toggleAll = () => {
    if (visibleSensors.size === sensors.length) {
      setVisibleSensors(new Set([sensors[0]?.sensorType].filter(Boolean)));
    } else {
      setVisibleSensors(new Set(sensors.map((s) => s.sensorType)));
    }
  };

  const visibleSensorData = useMemo(
    () => sensors.filter((s) => visibleSensors.has(s.sensorType)),
    [sensors, visibleSensors]
  );

  const chartData = useMemo(
    () => mergeTimeSeriesData(visibleSensorData),
    [visibleSensorData]
  );

  const uniqueUnits = useMemo(
    () => getUniqueUnits(visibleSensorData),
    [visibleSensorData]
  );

  const isEmpty = !sensors.length || !chartData.length;

  interface TooltipPayloadEntry { dataKey: string; color: string; value: number | null; payload: { timestamp: string }; }
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) => {
    if (!active || !payload?.length) {return null;}

    const timestamp = payload[0]?.payload?.timestamp;

    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg max-w-xs">
        <p className="font-medium text-sm mb-2 border-b pb-2">
          {format(new Date(timestamp), "MMM dd, HH:mm:ss")}
        </p>
        <div className="space-y-1">
          {payload.map((entry) => {
            const sensor = sensors.find(
              (s) => s.sensorType === entry.dataKey
            );
            return (
              <div
                key={entry.dataKey}
                className="flex items-center justify-between gap-4"
              >
                <span
                  className="text-sm flex items-center gap-2"
                  style={{ color: entry.color }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.dataKey}
                </span>
                <span className="text-sm font-medium">
                  {entry.value?.toFixed(2)} {sensor?.unit || ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const timeRangeActions = onTimeRangeChange && (
    <Select value={timeRange} onValueChange={onTimeRangeChange}>
      <SelectTrigger className="w-24" data-testid="select-time-range">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1h">1 Hour</SelectItem>
        <SelectItem value="6h">6 Hours</SelectItem>
        <SelectItem value="24h">24 Hours</SelectItem>
        <SelectItem value="7d">7 Days</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <ChartWrapper
      title={title}
      description={description}
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyMessage="No sensor data available for the selected time range"
      actions={timeRangeActions}
      data-testid={testId}
    >
      <div className="flex flex-col h-full">
        <div className="flex flex-wrap items-center gap-4 mb-4 pb-3 border-b">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAll}
            data-testid="btn-toggle-all"
          >
            {visibleSensors.size === sensors.length ? "Hide All" : "Show All"}
          </Button>

          <div className="flex flex-wrap gap-4">
            {sensors.map((sensor, idx) => (
              <div
                key={sensor.sensorType}
                className="flex items-center gap-2"
              >
                <Checkbox
                  id={`sensor-${sensor.sensorType}`}
                  checked={visibleSensors.has(sensor.sensorType)}
                  onCheckedChange={() => toggleSensor(sensor.sensorType)}
                  data-testid={`checkbox-${sensor.sensorType}`}
                />
                <Label
                  htmlFor={`sensor-${sensor.sensorType}`}
                  className="cursor-pointer flex items-center gap-1.5 text-sm"
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        sensor.color || CHART_COLORS[idx % CHART_COLORS.length],
                    }}
                  />
                  <span style={{ color: sensor.color || CHART_COLORS[idx % CHART_COLORS.length] }}>
                    {sensor.sensorType}
                  </span>
                  <span className="text-muted-foreground">({sensor.unit})</span>
                </Label>
              </div>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 60, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => format(new Date(ts), "HH:mm")}
              className="text-xs"
              tick={{ fill: "hsl(var(--foreground))" }}
            />

            {uniqueUnits[0] && (
              <YAxis
                yAxisId="left"
                className="text-xs"
                tick={{ fill: "hsl(var(--foreground))" }}
                label={{
                  value: uniqueUnits[0],
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "hsl(var(--foreground))" },
                }}
              />
            )}

            {uniqueUnits[1] && uniqueUnits[1] !== uniqueUnits[0] && (
              <YAxis
                yAxisId="right"
                orientation="right"
                className="text-xs"
                tick={{ fill: "hsl(var(--foreground))" }}
                label={{
                  value: uniqueUnits[1],
                  angle: 90,
                  position: "insideRight",
                  style: { fill: "hsl(var(--foreground))" },
                }}
              />
            )}

            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {visibleSensorData.map((sensor, index) => {
              const sensorUnit = sensor.unit;
              const yAxisId =
                sensorUnit === uniqueUnits[0]
                  ? "left"
                  : uniqueUnits[1] && sensorUnit === uniqueUnits[1]
                    ? "right"
                    : "left";

              return (
                <Line
                  key={sensor.sensorType}
                  type="monotone"
                  dataKey={sensor.sensorType}
                  name={`${sensor.sensorType} (${sensor.unit})`}
                  stroke={
                    sensor.color || CHART_COLORS[index % CHART_COLORS.length]
                  }
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  yAxisId={yAxisId}
                  data-testid={`line-${sensor.sensorType}`}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
  );
}

```

### `client/src/components/ai-health/InsightsTab.tsx` (519 lines)

```tsx
/**
 * Insights Tab
 * 
 * Vessel intelligence, feedback loop, and prediction feedback.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Brain, Loader2, ChevronDown, RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, Clock, ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { useFeedbackLoopData } from "@/features/analytics";

export default function InsightsTab() {
  const [expandedSections, setExpandedSections] = useState({
    vesselIntelligence: true,
    feedbackLoop: true,
    predictionFeedback: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-6">
      <Collapsible open={expandedSections.vesselIntelligence} onOpenChange={() => toggleSection("vesselIntelligence")}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Vessel Intelligence
                </CardTitle>
                <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.vesselIntelligence ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>AI-powered pattern analysis for each vessel</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <VesselIntelligenceSection />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={expandedSections.feedbackLoop} onOpenChange={() => toggleSection("feedbackLoop")}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Feedback Loop Intelligence
                </CardTitle>
                <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.feedbackLoop ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>How operator feedback improves AI accuracy</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <FeedbackLoopSection />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={expandedSections.predictionFeedback} onOpenChange={() => toggleSection("predictionFeedback")}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Prediction Feedback
                </CardTitle>
                <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.predictionFeedback ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Operator ratings and corrections for predictions</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <PredictionFeedbackSection />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

function VesselIntelligenceSection() {
  const [selectedVessel, setSelectedVessel] = useState<string>("");
  const [vesselIntelligence, setVesselIntelligence] = useState<any>(null);
  const [isLoadingIntelligence, setIsLoadingIntelligence] = useState(false);

  const { data: vessels = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/vessels"],
  });

  const loadVesselIntelligence = async () => {
    if (!selectedVessel) return;
    setIsLoadingIntelligence(true);
    try {
      const response = await fetch(`/api/analytics/vessel-intelligence/${selectedVessel}`);
      if (response.ok) {
        const data = await response.json();
        setVesselIntelligence(data);
      }
    } catch {
      console.error("Failed to load vessel intelligence");
    } finally {
      setIsLoadingIntelligence(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "text-red-500";
      case "high": return "text-orange-500";
      case "medium": return "text-yellow-500";
      default: return "text-blue-500";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[200px] space-y-1">
          <Label className="text-xs font-medium">Select Vessel</Label>
          <Select value={selectedVessel} onValueChange={setSelectedVessel}>
            <SelectTrigger data-testid="select-vessel-intelligence">
              <SelectValue placeholder="Select vessel" />
            </SelectTrigger>
            <SelectContent>
              {vessels.map((vessel) => (
                <SelectItem key={vessel.id} value={vessel.id}>{vessel.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={loadVesselIntelligence} disabled={isLoadingIntelligence || !selectedVessel} data-testid="button-load-intelligence">
          {isLoadingIntelligence ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> : <><Brain className="mr-2 h-4 w-4" />Analyze Vessel</>}
        </Button>
      </div>

      {!vesselIntelligence ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <Brain className="h-12 w-12 mb-4 opacity-50" />
          <p>Select a vessel and click "Analyze Vessel" to see AI insights</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-4 pr-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Health Score</p>
                  <p className="text-2xl font-bold">{vesselIntelligence.healthScore || 0}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Active Alerts</p>
                  <p className="text-2xl font-bold">{vesselIntelligence.activeAlerts || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Predictions</p>
                  <p className="text-2xl font-bold">{vesselIntelligence.totalPredictions || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Risk Level</p>
                  <Badge className={getSeverityColor(vesselIntelligence.riskLevel || "low")}>
                    {vesselIntelligence.riskLevel || "low"}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {vesselIntelligence.insights && vesselIntelligence.insights.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">AI Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {vesselIntelligence.insights.map((insight: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className={getSeverityColor(insight.severity)}>
                          {insight.severity}
                        </Badge>
                        <div>
                          <p className="font-medium text-sm">{insight.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {vesselIntelligence.patterns && vesselIntelligence.patterns.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Detected Patterns</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {vesselIntelligence.patterns.map((pattern: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <span>{pattern.description}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function FeedbackLoopSection() {
  const { retrainingQueue, queueLoading, modelImprovements, improvementsLoading, correctionPatterns, patternsLoading, highPriorityCount, hasHighPriorityRetraining, getPriorityBadge, getImprovementBadge } = useFeedbackLoopData();

  return (
    <div className="space-y-4">
      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">How This Works</AlertTitle>
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          When operators rate predictions or report inaccuracies, the system automatically queues models for retraining.
        </AlertDescription>
      </Alert>

      {hasHighPriorityRetraining && (
        <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-900 dark:text-amber-100">High Priority Retraining Needed</AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>{highPriorityCount} model{highPriorityCount > 1 ? "s are" : " is"}</strong> waiting for high-priority retraining.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Pending Retraining
              <InfoTooltip content="Models waiting to be retrained based on operator feedback." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {queueLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-3xl font-bold">{retrainingQueue?.totalPending ?? 0}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Models Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            {improvementsLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-3xl font-bold">{modelImprovements?.length ?? 0}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Inaccurate Predictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {patternsLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-3xl font-bold">{correctionPatterns?.inaccuracyCount ?? 0}</p>}
          </CardContent>
        </Card>
      </div>

      {retrainingQueue?.queue && retrainingQueue.queue.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Retraining Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retrainingQueue.queue.slice(0, 5).map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.modelName}</TableCell>
                      <TableCell><Badge variant="outline">{item.triggerType.replaceAll("_", " ")}</Badge></TableCell>
                      <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {modelImprovements && modelImprovements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Model Improvement Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead className="text-right">Accuracy</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelImprovements.slice(0, 5).map((model) => (
                    <TableRow key={model.modelId}>
                      <TableCell className="font-medium">{model.modelName}</TableCell>
                      <TableCell><Badge>{model.currentVersion}</Badge></TableCell>
                      <TableCell className="text-right">
                        {model.currentAccuracy === null ? "—" : `${(model.currentAccuracy * 100).toFixed(1)}%`}
                      </TableCell>
                      <TableCell>{getImprovementBadge(model.improvementStatus)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PredictionFeedbackSection() {
  interface FeedbackSummary {
    feedbackType: string;
    feedbackStatus: string;
    count: number;
    avgRating: number | null;
  }

  interface PredictionFeedbackItem {
    feedback: {
      id: number;
      predictionId: number;
      predictionType: string;
      equipmentId: string;
      userId: string;
      feedbackType: string;
      rating: number | null;
      isAccurate: boolean | null;
      comments: string | null;
      feedbackStatus: string;
      createdAt: Date;
    };
    equipmentName: string | null;
  }

  const { data: summary, isLoading: summaryLoading } = useQuery<FeedbackSummary[]>({
    queryKey: ["/api/analytics/prediction-feedback/summary"],
  });

  const { data: feedback, isLoading: feedbackLoading } = useQuery<PredictionFeedbackItem[]>({
    queryKey: ["/api/analytics/prediction-feedback"],
  });

  const totalFeedback = summary?.reduce((acc, item) => acc + item.count, 0) || 0;
  const pendingReview = summary?.find((s) => s.feedbackStatus === "pending")?.count || 0;
  const approved = summary?.find((s) => s.feedbackStatus === "approved")?.count || 0;

  const getFeedbackTypeBadge = (type: string) => {
    switch (type) {
      case "correction": return <Badge className="bg-blue-500">Correction</Badge>;
      case "rating": return <Badge className="bg-purple-500">Rating</Badge>;
      case "flag": return <Badge variant="destructive">Flagged</Badge>;
      default: return <Badge variant="secondary">{type}</Badge>;
    }
  };

  if (summaryLoading || feedbackLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Feedback</span>
            </div>
            <p className="text-2xl font-bold">{totalFeedback}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Pending Review</span>
            </div>
            <p className="text-2xl font-bold">{pendingReview}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Approved</span>
            </div>
            <p className="text-2xl font-bold">{approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ThumbsUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Accurate</span>
            </div>
            <p className="text-2xl font-bold">
              {feedback?.filter((f) => f.feedback.isAccurate === true).length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {feedback && feedback.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Recent Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Accurate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedback.slice(0, 10).map((item) => (
                    <TableRow key={item.feedback.id}>
                      <TableCell className="font-medium">{item.equipmentName || item.feedback.equipmentId}</TableCell>
                      <TableCell>{getFeedbackTypeBadge(item.feedback.feedbackType)}</TableCell>
                      <TableCell>
                        {item.feedback.isAccurate === true ? (
                          <ThumbsUp className="h-4 w-4 text-green-500" />
                        ) : item.feedback.isAccurate === false ? (
                          <ThumbsDown className="h-4 w-4 text-red-500" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.feedback.feedbackStatus === "approved" ? "default" : "secondary"}>
                          {item.feedback.feedbackStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(item.feedback.createdAt), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No prediction feedback submitted yet</p>
        </div>
      )}
    </div>
  );
}

```

### `client/src/components/ai-health/PerformanceTab.tsx` (550 lines)

```tsx
/**
 * Performance Tab
 * 
 * Model performance metrics, drift detection, equipment accuracy, 
 * feature importance, and SHAP explainability.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Activity, Target, TrendingUp, AlertTriangle, CheckCircle2, RefreshCw, Ship, Waves, ChevronDown, Brain, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { getFriendlyModelName } from "@/lib/ml-terminology";
import { useModelPerformanceData } from "@/features/ml-ai";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { ExplainabilityVisualization } from "@/components/ml/ExplainabilityVisualization";

export default function PerformanceTab() {
  const m = useModelPerformanceData();
  const [expandedSections, setExpandedSections] = useState({
    drift: true,
    equipment: false,
    features: false,
    explainability: false,
    marine: false,
    validations: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const AccuracyBadge = ({ accuracy }: { accuracy: number | null }) => {
    const d = m.getAccuracyBadgeData(accuracy);
    if (d.isPending) {
      return <Badge variant="secondary" data-testid="badge-pending">Pending</Badge>;
    }
    return (
      <Badge className={d.className} data-testid={`badge-${d.label.toLowerCase().replace(" ", "-")}`} title={d.description}>
        {d.label} ({d.percent.toFixed(1)}%)
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3 overflow-x-auto pb-2">
        <Card className="flex-1 min-w-[200px] p-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                Active AI Models
                <InfoTooltip content="Number of different AI models currently making predictions for your equipment." />
              </p>
              {m.summaryLoading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold" data-testid="stat-active-models">{m.overallMetrics?.totalModels || 0}</p>}
            </div>
          </div>
        </Card>
        <Card className="flex-1 min-w-[200px] p-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-500" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Total Predictions</p>
              {m.summaryLoading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold" data-testid="stat-total-predictions">{m.overallMetrics?.totalPredictions || 0}</p>}
            </div>
          </div>
        </Card>
        <Card className="flex-1 min-w-[200px] p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                Validated
                <InfoTooltip content="Predictions that have been checked against actual equipment failures to measure accuracy." />
              </p>
              {m.summaryLoading ? <Skeleton className="h-7 w-16" /> : (
                <p className="text-2xl font-bold" data-testid="stat-validated">
                  {m.overallMetrics?.totalValidated || 0}
                  <span className="text-sm text-muted-foreground ml-1">({m.validationRate.toFixed(0)}%)</span>
                </p>
              )}
            </div>
          </div>
        </Card>
        <Card className="flex-1 min-w-[200px] p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                Avg Accuracy
                <InfoTooltip content="How often the AI predictions are correct. 90%+ is excellent, 80%+ is good." />
              </p>
              {m.summaryLoading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold" data-testid="stat-avg-accuracy">{m.overallAvgAccuracy.toFixed(1)}%</p>}
            </div>
          </div>
        </Card>
      </div>

      {m.criticalDrift.length > 0 && (
        <Alert variant="destructive" data-testid="alert-drift">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Model Accuracy Declining</AlertTitle>
          <AlertDescription>
            <strong>{m.criticalDrift.length} model{m.criticalDrift.length > 1 ? "s have" : " has"}</strong> accuracy drops of {Math.abs(m.criticalDrift[0].driftPercent).toFixed(1)}%+.
            <div className="mt-3 space-y-2">
              <div className="font-semibold">Recommended Actions:</div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Schedule model retraining this week with recent data</li>
                <li>Review if new equipment or maintenance procedures were introduced</li>
              </ul>
              <Button size="sm" className="mt-2" data-testid="button-schedule-retraining">
                <RefreshCw className="h-3 w-3 mr-1" />Schedule Retraining
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base" data-testid="heading-model-summary">Model Performance Summary</CardTitle>
          <CardDescription>Accuracy metrics by model</CardDescription>
        </CardHeader>
        <CardContent>
          {m.summaryLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : m.summary && m.summary.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Predictions</TableHead>
                    <TableHead className="text-right">Validated</TableHead>
                    <TableHead className="text-right">Accuracy</TableHead>
                    <TableHead>Last Validation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.summary.map((model, index) => (
                    <TableRow key={model.modelId} data-testid={`row-model-${index}`}>
                      <TableCell className="font-medium">{model.modelName || model.modelId}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getFriendlyModelName(model.modelType)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{model.totalPredictions}</TableCell>
                      <TableCell className="text-right">{model.validatedPredictions}</TableCell>
                      <TableCell className="text-right">
                        <AccuracyBadge accuracy={model.avgAccuracy} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {model.lastValidation ? formatDistanceToNow(new Date(model.lastValidation), { addSuffix: true }) : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No model performance data available</p>
          )}
        </CardContent>
      </Card>

      {m.modelDriftData.length > 0 && m.modelDriftData.some((md) => md.severity !== "none") && (
        <Collapsible open={expandedSections.drift} onOpenChange={() => toggleSection("drift")}>
          <Card className="border-amber-500">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer bg-amber-500/10">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    Accuracy Declining Over Time
                  </CardTitle>
                  <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.drift ? "rotate-180" : ""}`} />
                </div>
                <CardDescription>These models are getting less accurate and may need retraining</CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-4 space-y-3">
                {m.modelDriftData.filter((md) => md.severity !== "none").map((drift, idx) => (
                  <div
                    key={drift.modelId}
                    className={`p-3 border rounded-lg ${drift.severity === "severe" ? "bg-red-500/10 border-red-500" : drift.severity === "moderate" ? "bg-amber-500/10 border-amber-500" : "bg-blue-500/10 border-blue-500"}`}
                    data-testid={`drift-alert-${idx}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{drift.modelName}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Accuracy dropped from {(drift.baselineAccuracy * 100).toFixed(1)}% to {(drift.recentAccuracy * 100).toFixed(1)}% ({drift.driftPercent.toFixed(1)}% change)
                        </p>
                      </div>
                      <Badge className={drift.severity === "severe" ? "bg-red-600" : drift.severity === "moderate" ? "bg-amber-600" : "bg-blue-600"}>
                        {drift.severity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {m.equipmentTypeAccuracy && m.equipmentTypeAccuracy.length > 0 && (
        <Collapsible open={expandedSections.equipment} onOpenChange={() => toggleSection("equipment")}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-1">
                    Accuracy by Equipment Type
                    <InfoTooltip content="Compare how well the AI predicts failures for different equipment types." />
                  </CardTitle>
                  <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.equipment ? "rotate-180" : ""}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipment Type</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Predictions</TableHead>
                        <TableHead className="text-right">Accuracy</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {m.equipmentTypeAccuracy.map((item, idx) => (
                        <TableRow key={item.equipmentType} data-testid={`row-eq-type-${idx}`}>
                          <TableCell><Badge variant="outline">{item.equipmentType}</Badge></TableCell>
                          <TableCell className="text-right">{item.equipmentCount}</TableCell>
                          <TableCell className="text-right">{item.totalPredictions}</TableCell>
                          <TableCell className="text-right">
                            {item.avgAccuracy ? <AccuracyBadge accuracy={item.avgAccuracy} /> : <Badge variant="secondary">N/A</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {m.featureTrends && m.featureTrends.length > 0 && (
        <Collapsible open={expandedSections.features} onOpenChange={() => toggleSection("features")}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-1">
                    Which Sensors Matter Most
                    <InfoTooltip content="Feature Importance shows which sensor readings have the biggest impact on AI predictions." />
                  </CardTitle>
                  <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.features ? "rotate-180" : ""}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Feature</TableHead>
                        <TableHead className="text-right">Importance</TableHead>
                        <TableHead className="text-right">Predictions</TableHead>
                        <TableHead className="text-right">Trend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {m.featureTrends.map((feature, idx) => (
                        <TableRow key={feature.featureName} data-testid={`row-feature-${idx}`}>
                          <TableCell className="font-medium">{feature.featureName}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500" style={{ width: `${Math.min(100, feature.avgImportance * 100)}%` }} />
                              </div>
                              <span className="text-sm">{feature.avgImportance.toFixed(3)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{feature.count}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={feature.trend === "increasing" ? "default" : feature.trend === "decreasing" ? "secondary" : "outline"}>
                              {feature.trend}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      <Collapsible open={expandedSections.explainability} onOpenChange={() => toggleSection("explainability")}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  ML Explainability (SHAP)
                </CardTitle>
                <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.explainability ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Understand why the AI made specific predictions</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <ExplainabilitySection />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={expandedSections.marine} onOpenChange={() => toggleSection("marine")}>
        <Card className="border-blue-500">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer bg-blue-500/10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Ship className="w-5 h-5 text-blue-600" />
                  Marine Equipment Intelligence
                </CardTitle>
                <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.marine ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Insights specific to marine fleet operations</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-4 space-y-4">
              <Alert className="bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-800">
                <Waves className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <AlertTitle className="text-cyan-900 dark:text-cyan-100">Weather-Aware Threshold Adjustments</AlertTitle>
                <AlertDescription className="text-cyan-800 dark:text-cyan-200">
                  <p className="mb-2">ARUS automatically adjusts prediction thresholds based on sea conditions.</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li><strong>30-40% fewer false alarms</strong> during rough weather</li>
                    <li>Crew isn't distracted by non-critical alerts</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg bg-muted/30">
                  <h3 className="text-sm font-semibold mb-2">Oil Analysis Integration</h3>
                  <p className="text-xs text-muted-foreground">When wear particles exceed thresholds, ARUS raises prediction priority for related components.</p>
                </div>
                <div className="p-3 border rounded-lg bg-muted/30">
                  <h3 className="text-sm font-semibold mb-2">STCW Hours of Rest Aware</h3>
                  <p className="text-xs text-muted-foreground">Maintenance recommendations respect crew availability and STCW compliance.</p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={expandedSections.validations} onOpenChange={() => toggleSection("validations")}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Validations</CardTitle>
                <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.validations ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Latest prediction validation results</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {m.validationsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : m.validations && m.validations.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Accuracy</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {m.validations.slice(0, 10).map((item, index) => (
                        <TableRow key={item.validation.id} data-testid={`row-validation-${index}`}>
                          <TableCell className="font-medium">{item.equipmentName || item.validation.equipmentId}</TableCell>
                          <TableCell className="text-sm">{item.modelName || "Unknown"}</TableCell>
                          <TableCell><Badge variant="outline">{item.validation.predictionType}</Badge></TableCell>
                          <TableCell><AccuracyBadge accuracy={item.validation.accuracyScore} /></TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.validation.validatedAt ? formatDistanceToNow(new Date(item.validation.validatedAt), { addSuffix: true }) : "Pending"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No validation data available</p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

function ExplainabilitySection() {
  const [selectedPredictionId, setSelectedPredictionId] = useState<number | null>(null);
  const [filterEquipment, setFilterEquipment] = useState<string>("all");

  interface RealtimePrediction {
    id: number;
    equipmentId: string;
    equipmentName: string;
    modelId: string;
    predictionType: string;
    predictionValue: number;
    confidence: number;
    predictionTimestamp: Date;
    hasExplanation: boolean;
    explanationId: number | null;
  }

  const { data: predictions, isLoading: predictionsLoading } = useQuery<RealtimePrediction[]>({
    queryKey: ["/api/ml/realtime-predictions", { equipmentId: filterEquipment === "all" ? undefined : filterEquipment }],
  });

  const { data: explanation, isLoading: explanationLoading } = useQuery({
    queryKey: selectedPredictionId ? [`/api/ml/explainability/predictions/${selectedPredictionId}`, { type: "real_time" }] : [],
    enabled: !!selectedPredictionId,
  });

  const equipmentOptions = predictions ? Array.from(new Set(predictions.map((p) => p.equipmentId))) : [];
  const filteredPredictions = predictions?.filter((p) => filterEquipment === "all" || p.equipmentId === filterEquipment);

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.85) return <Badge className="bg-green-500">Very Confident</Badge>;
    if (confidence >= 0.7) return <Badge className="bg-blue-500">Confident</Badge>;
    if (confidence >= 0.5) return <Badge className="bg-yellow-500">Moderate</Badge>;
    return <Badge variant="destructive">Low Confidence</Badge>;
  };

  if (predictionsLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (!predictions || predictions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No predictions available for explainability analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[200px] space-y-1">
          <Label className="text-xs font-medium">Filter by Equipment</Label>
          <Select value={filterEquipment} onValueChange={setFilterEquipment}>
            <SelectTrigger data-testid="select-filter-equipment">
              <SelectValue placeholder="All equipment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Equipment</SelectItem>
              {equipmentOptions.map((eq) => (
                <SelectItem key={eq} value={eq}>{eq}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <p className="text-sm font-medium">Select a prediction to explain:</p>
          {filteredPredictions?.slice(0, 10).map((pred) => (
            <div
              key={pred.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedPredictionId === pred.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
              onClick={() => setSelectedPredictionId(pred.id)}
              data-testid={`prediction-item-${pred.id}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{pred.equipmentName || pred.equipmentId}</span>
                {getConfidenceBadge(pred.confidence)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{pred.predictionType}</p>
            </div>
          ))}
        </div>

        <div>
          {selectedPredictionId ? (
            explanationLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : explanation ? (
              <ExplainabilityVisualization explanation={explanation} />
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <p>No explanation data available for this prediction</p>
              </div>
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Select a prediction to see why the AI made that decision</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

```

### `client/src/components/ai-health/ReportsTab.tsx` (281 lines)

```tsx
/**
 * Reports Tab
 * 
 * AI-generated reports with multi-model support.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, Zap, Loader2, Sparkles, ChevronDown, CheckCircle2, TrendingUp, AlertTriangle, BarChart3 } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { ReportSummaryCards } from "@/components/ReportSummaryCards";
import { type ReportType, type AudienceType, type ModelType, useAiInsightsData } from "@/features/ml-ai";
import { formatNumber, formatDate } from "@/lib/formatters";

export default function ReportsTab() {
  const { 
    reportType, setReportType, 
    audience, setAudience, 
    selectedModel, setSelectedModel, 
    selectedVessel, setSelectedVessel, 
    generatedReport, 
    isGenerating, 
    openSections, setOpenSections,
    vessels, models, audiences, 
    generateReport 
  } = useAiInsightsData();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle className="text-base">Generate AI Report</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Multi-Model AI
            </Badge>
          </div>
          <CardDescription>Create comprehensive reports using AI analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                Report Type
                <InfoTooltip content="Health: Equipment condition | Fleet: All vessels overview | Maintenance: Upcoming repairs | Compliance: Regulatory status" />
              </Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger className="h-9" data-testid="select-report-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="health">Health Report</SelectItem>
                  <SelectItem value="fleet">Fleet Summary</SelectItem>
                  <SelectItem value="maintenance">Maintenance Report</SelectItem>
                  <SelectItem value="compliance">Compliance Report</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[180px] space-y-1.5">
              <Label className="text-xs font-medium">Vessel</Label>
              <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                <SelectTrigger className="h-9" data-testid="select-vessel">
                  <SelectValue placeholder="Select vessel" />
                </SelectTrigger>
                <SelectContent>
                  {vessels.filter((v) => v.id).map((vessel) => (
                    <SelectItem key={vessel.id} value={vessel.id}>{vessel.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[160px] space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                Audience
                <InfoTooltip content="Executive: High-level summary | Technical: Engineering details | Maintenance: Action-focused | Compliance: Regulatory focus" />
              </Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as AudienceType)}>
                <SelectTrigger className="h-9" data-testid="select-audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {audiences.map((aud) => (
                    <SelectItem key={aud.id} value={aud.id}>{aud.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[140px] space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                AI Model
                <InfoTooltip content="GPT-4o: Balanced speed & quality | Claude: Detailed analysis | O1: Advanced reasoning" />
              </Label>
              <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ModelType)}>
                <SelectTrigger className="h-9" data-testid="select-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.recommended && <Sparkles className="h-3 w-3 mr-1 inline text-yellow-500" />}
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={generateReport} disabled={isGenerating || (reportType !== "fleet" && !selectedVessel)} className="h-9" data-testid="button-generate-report">
              {isGenerating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
              ) : (
                <><Zap className="mr-2 h-4 w-4" />Generate</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AI-Generated Report</CardTitle>
          <CardDescription className="text-xs">
            {generatedReport ? `Generated ${formatDate(generatedReport.timestamp)}` : "Configure and generate a report"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!generatedReport ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No report generated yet</p>
              <p className="text-sm text-muted-foreground mt-1">Configure parameters and click "Generate"</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-6 pr-4">
                <ReportSummaryCards content={generatedReport.content} reportType={generatedReport.reportType} audience={generatedReport.audience} />

                <Separator className="my-6" />
                <div className="text-sm text-muted-foreground text-center py-2">Expand sections below for detailed analysis</div>

                <Collapsible open={openSections.analysis} onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, analysis: open }))}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      AI Analysis
                    </h3>
                    <ChevronDown className={`h-4 w-4 transition-transform ${openSections.analysis ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">{generatedReport.content.analysis}</div>
                  </CollapsibleContent>
                </Collapsible>

                {generatedReport.content.scenarios && generatedReport.content.scenarios.length > 0 && (
                  <Collapsible open={openSections.scenarios} onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, scenarios: open }))}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity mb-3">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Scenario Analysis ({generatedReport.content.scenarios.length})
                        <InfoTooltip content="Possible future outcomes based on current equipment data and trends." />
                      </h3>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSections.scenarios ? "rotate-180" : ""}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-4">
                        {generatedReport.content.scenarios.map((scenario, idx) => (
                          <Card key={`scenario-${idx}`} className="border-l-4" style={{ borderLeftColor: scenario.impact === "critical" ? "#ef4444" : scenario.impact === "high" ? "#f97316" : scenario.impact === "medium" ? "#eab308" : "#3b82f6" }}>
                            <CardContent className="pt-4">
                              <div className="flex items-start gap-2 mb-2">
                                <Badge variant="outline" className="text-xs">{scenario.impact.toUpperCase()}</Badge>
                                <Badge variant="secondary" className="text-xs">{Math.round(scenario.probability * 100)}% probability</Badge>
                              </div>
                              <p className="font-medium mb-2 text-sm">{scenario.scenario}</p>
                              {scenario.recommendations.length > 0 && (
                                <ul className="space-y-1 mt-2">
                                  {scenario.recommendations.map((rec, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                                      <span className="text-xs text-muted-foreground">{rec}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {generatedReport.content.roi && (
                  <Collapsible open={openSections.roi} onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, roi: open }))}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity mb-3">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        ROI Analysis
                        <InfoTooltip content="Return on Investment: Expected cost savings from recommended actions." />
                      </h3>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSections.roi ? "rotate-180" : ""}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-2 gap-4">
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Estimated Savings</p>
                            <p className="text-xl font-bold text-green-600 dark:text-green-400">${formatNumber(generatedReport.content.roi.estimatedSavings)}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Investment Required</p>
                            <p className="text-xl font-bold">${formatNumber(generatedReport.content.roi.investmentRequired)}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Payback Period</p>
                            <p className="text-xl font-bold">{generatedReport.content.roi.paybackPeriod} months</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Risk Reduction</p>
                            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{Math.round(generatedReport.content.roi.riskReduction * 100)}%</p>
                          </CardContent>
                        </Card>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {generatedReport.content.citations && generatedReport.content.citations.length > 0 && (
                  <Collapsible open={openSections.citations} onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, citations: open }))}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity mb-3">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        Sources & Citations ({generatedReport.content.citations.length})
                        <InfoTooltip content="Data sources used to generate this report." />
                      </h3>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSections.citations ? "rotate-180" : ""}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2">
                        {generatedReport.content.citations.map((citation, idx) => (
                          <Card key={`citation-${idx}`}>
                            <CardContent className="pt-3 pb-3">
                              <div className="flex items-start gap-2">
                                <Badge variant="outline" className="text-xs">{Math.round(citation.relevance * 100)}%</Badge>
                                <div className="flex-1">
                                  <p className="font-medium text-xs mb-1">{citation.source}</p>
                                  <p className="text-xs text-muted-foreground">{citation.snippet}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

```

### `client/src/components/ai-health/TrainingTab.tsx` (467 lines)

```tsx
/**
 * Training Tab
 * 
 * ML model training interface with admin controls.
 * Includes LSTM, Random Forest, Acoustic analysis, and data management.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Brain, Loader2, CheckCircle2, AlertCircle, TrendingUp, Activity, Radio, Play, Database, Info, Download, Trash2, AlertTriangle } from "lucide-react";
import { useTrainingData } from "@/features/ml-ai";

export default function TrainingTab() {
  const t = useTrainingData();

  return (
    <div className="space-y-6">
      <Tabs defaultValue="lstm" className="space-y-4">
        <div className="overflow-x-auto pb-2">
          <TabsList className="inline-flex w-full min-w-fit p-1 gap-1">
            <TabsTrigger value="lstm" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]" data-testid="tab-lstm">
              <Brain className="h-4 w-4 mr-2" />
              <span>LSTM Training</span>
            </TabsTrigger>
            <TabsTrigger value="rf" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]" data-testid="tab-random-forest">
              <TrendingUp className="h-4 w-4 mr-2" />
              <span>Random Forest</span>
            </TabsTrigger>
            <TabsTrigger value="acoustic" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]" data-testid="tab-acoustic">
              <Radio className="h-4 w-4 mr-2" />
              <span>Acoustic Analysis</span>
            </TabsTrigger>
            <TabsTrigger value="models" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]" data-testid="tab-models">
              <Database className="h-4 w-4 mr-2" />
              <span>Trained Models</span>
            </TabsTrigger>
            <TabsTrigger value="reset" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] text-destructive" data-testid="tab-reset-data">
              <Trash2 className="h-4 w-4 mr-2" />
              <span>Reset Data</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="lstm" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                LSTM Training
                <InfoTooltip content="LSTM (Long Short-Term Memory) - An AI that learns patterns in equipment data over time to predict failures." />
              </CardTitle>
              <CardDescription>Teach the AI to recognize patterns in equipment data over time</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  <strong>Smart Adaptive Training:</strong> The system automatically uses optimal training data range based on available history.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="lstm-equipment-type">Equipment Type (Optional)</Label>
                  <Select value={t.selectedEquipmentType} onValueChange={t.setSelectedEquipmentType}>
                    <SelectTrigger id="lstm-equipment-type" data-testid="select-lstm-equipment">
                      <SelectValue placeholder="All Equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Equipment</SelectItem>
                      {t.uniqueEquipmentTypes.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lstm-epochs">Training Epochs</Label>
                  <Input id="lstm-epochs" type="number" defaultValue="50" min="10" max="200" data-testid="input-lstm-epochs" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lstm-sequence">Sequence Length</Label>
                  <Input id="lstm-sequence" type="number" defaultValue="10" min="5" max="50" data-testid="input-lstm-sequence" />
                </div>
              </div>

              <Button onClick={t.handleTrainLSTM} disabled={t.trainLSTM.isPending} className="w-full" data-testid="button-train-lstm">
                {t.trainLSTM.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Training LSTM Model...</>
                ) : (
                  <><Play className="h-4 w-4 mr-2" />Train LSTM Model</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rf" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Random Forest Training
                <InfoTooltip content="Random Forest - An AI that classifies equipment health status based on current sensor readings." />
              </CardTitle>
              <CardDescription>Teach the AI to assess equipment health by analyzing current sensor data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  <strong>Smart Adaptive Training:</strong> Uses optimal data range automatically (90-730 days based on availability).
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rf-equipment-type">Equipment Type (Optional)</Label>
                  <Select value={t.selectedEquipmentType} onValueChange={t.setSelectedEquipmentType}>
                    <SelectTrigger id="rf-equipment-type" data-testid="select-rf-equipment">
                      <SelectValue placeholder="All Equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Equipment</SelectItem>
                      {t.uniqueEquipmentTypes.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rf-trees">Number of Trees</Label>
                  <Input id="rf-trees" type="number" defaultValue="50" min="10" max="200" data-testid="input-rf-trees" />
                </div>
              </div>

              <Button onClick={t.handleTrainRandomForest} disabled={t.trainRandomForest.isPending} className="w-full" data-testid="button-train-rf">
                {t.trainRandomForest.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Training Random Forest...</>
                ) : (
                  <><Play className="h-4 w-4 mr-2" />Train Random Forest Model</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acoustic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                Acoustic Monitoring Analysis
              </CardTitle>
              <CardDescription>Analyze acoustic waveforms for frequency signatures and anomaly detection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Acoustic analysis uses FFT to extract frequency signatures and detect abnormal sound patterns.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="acoustic-data">Acoustic Waveform Data (comma-separated values)</Label>
                <Textarea
                  id="acoustic-data"
                  placeholder="0.1, 0.2, -0.1, 0.3, -0.2, 0.15, -0.05, 0.25..."
                  value={t.acousticData}
                  onChange={(e) => t.setAcousticData(e.target.value)}
                  rows={4}
                  data-testid="input-acoustic-data"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sample-rate">Sample Rate (Hz)</Label>
                  <Input id="sample-rate" type="number" value={t.sampleRate} onChange={(e) => t.setSampleRate(e.target.value)} data-testid="input-sample-rate" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rpm">RPM (Optional)</Label>
                  <Input id="rpm" type="number" value={t.rpm} onChange={(e) => t.setRpm(e.target.value)} placeholder="e.g., 1800" data-testid="input-rpm" />
                </div>
              </div>

              <Button onClick={() => t.analyzeAcoustic.mutate()} disabled={t.analyzeAcoustic.isPending || !t.acousticData} className="w-full" data-testid="button-analyze-acoustic">
                {t.analyzeAcoustic.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</>
                ) : (
                  <><Activity className="h-4 w-4 mr-2" />Analyze Acoustic Data</>
                )}
              </Button>

              {t.acousticResults && (
                <Card className="mt-4 bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      Analysis Results
                      <Badge variant={t.acousticResults.severity === "critical" ? "destructive" : t.acousticResults.severity === "warning" ? "default" : "outline"}>
                        {t.acousticResults.severity}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-sm font-medium mb-2">Health Score</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${t.acousticResults.healthScore}%` }} />
                        </div>
                        <span className="text-sm font-medium">{t.acousticResults.healthScore.toFixed(0)}%</span>
                      </div>
                    </div>

                    {t.acousticResults.features && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-muted-foreground">RMS Level:</span><span className="ml-2 font-medium">{t.acousticResults.features.rms?.toFixed(3)}</span></div>
                        <div><span className="text-muted-foreground">Peak Amplitude:</span><span className="ml-2 font-medium">{t.acousticResults.features.peakAmplitude?.toFixed(3)}</span></div>
                        <div><span className="text-muted-foreground">Dominant Frequency:</span><span className="ml-2 font-medium">{t.acousticResults.features.dominantFrequency?.toFixed(1)} Hz</span></div>
                        <div><span className="text-muted-foreground">SNR:</span><span className="ml-2 font-medium">{t.acousticResults.features.snr?.toFixed(1)} dB</span></div>
                      </div>
                    )}

                    {t.acousticResults.primaryIssues?.length > 0 && (
                      <div>
                        <div className="text-sm font-medium mb-2">Primary Issues</div>
                        <ul className="space-y-1">
                          {t.acousticResults.primaryIssues.map((issue: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {t.acousticResults.recommendations?.length > 0 && (
                      <div>
                        <div className="text-sm font-medium mb-2">Recommendations</div>
                        <ul className="space-y-1">
                          {t.acousticResults.recommendations.map((rec: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />{rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Trained ML Models
              </CardTitle>
              <CardDescription>View and manage your trained machine learning models</CardDescription>
            </CardHeader>
            <CardContent>
              {t.isLoadingModels ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : t.mlModels.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No trained models yet</p>
                  <p className="text-sm mt-1">Train an LSTM or Random Forest model to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Performance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {t.mlModels.map((model) => {
                        const tier = model.hyperparameters?.dataQualityTier;
                        return (
                          <TableRow key={model.id}>
                            <TableCell className="font-medium">{model.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {model.modelType === "failure_prediction" ? "LSTM" : model.modelType === "health_classification" ? "Random Forest" : model.modelType}
                              </Badge>
                            </TableCell>
                            <TableCell>{model.targetEquipmentType || "All"}</TableCell>
                            <TableCell>
                              {model.performance?.accuracy ? (
                                <span className="text-sm">{(model.performance.accuracy * 100).toFixed(1)}% accuracy</span>
                              ) : (
                                <span className="text-muted-foreground text-sm">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {model.status === "active" ? (
                                <Badge variant="default" className="bg-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary">{model.status}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(model.createdAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export ML/PDM Data
              </CardTitle>
              <CardDescription>Export machine learning models and predictions for external use</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  <strong>Data Portability:</strong> Export your ML/PDM data to migrate to IBM Maximo, Azure IoT, SAP PM, or other platforms.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reset" className="space-y-4">
          <Alert variant="destructive" className="border-2">
            <AlertTriangle className="h-5 w-5" />
            <AlertDescription className="text-lg font-semibold">DESTRUCTIVE OPERATION - USE WITH CAUTION</AlertDescription>
          </Alert>

          <Card className="border-destructive border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Reset ML Training Data
              </CardTitle>
              <CardDescription>Permanently delete synthetic telemetry data and optionally trained models</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-amber-900 dark:text-amber-100">
                  <strong>When to use this:</strong> This reset function is designed for development and testing.
                </AlertDescription>
              </Alert>

              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <h3 className="font-semibold text-destructive">What will be deleted:</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2"><span className="text-destructive">-</span><span><strong>All telemetry records</strong> for your organization</span></li>
                  <li className="flex items-start gap-2"><span className="text-destructive">-</span><span><strong>All failure predictions</strong> generated by ML models</span></li>
                  <li className="flex items-start gap-2"><span className="text-destructive">-</span><span><strong>All anomaly detections</strong> from monitoring systems</span></li>
                  <li className="flex items-start gap-2"><span className="text-destructive">-</span><span><strong>Optionally:</strong> All trained ML models</span></li>
                </ul>
              </div>

              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  <strong>What is preserved:</strong> Equipment records, sensor configurations, alert settings, and maintenance schedules remain intact.
                </AlertDescription>
              </Alert>

              <div className="pt-4 space-y-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="lg" className="w-full" disabled={t.resetMLData.isPending} data-testid="button-reset-ml-data-keep-models">
                      {t.resetMLData.isPending ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Deleting...</>
                      ) : (
                        <><Trash2 className="mr-2 h-5 w-5" />Reset Training Data (Keep Models)</>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />Confirm ML Data Reset
                      </AlertDialogTitle>
                      <AlertDialogDescription className="space-y-3 pt-2">
                        <p className="font-semibold">This will permanently delete all telemetry, predictions, and anomaly data.</p>
                        <p>Trained ML models will be preserved.</p>
                        <p className="text-destructive font-semibold">This action cannot be undone.</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => t.resetMLData.mutate({ deleteModels: false })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Yes, Delete Training Data
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="lg" className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" disabled={t.resetMLData.isPending} data-testid="button-reset-ml-data-delete-models">
                      {t.resetMLData.isPending ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Deleting...</>
                      ) : (
                        <><Trash2 className="mr-2 h-5 w-5" />Reset Everything (Including Models)</>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />Confirm Complete Reset
                      </AlertDialogTitle>
                      <AlertDialogDescription className="space-y-3 pt-2">
                        <p className="font-semibold text-destructive">This will permanently delete ALL ML data including trained models.</p>
                        <p className="text-destructive font-bold">This action cannot be undone. Are you absolutely sure?</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => t.resetMLData.mutate({ deleteModels: true })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Yes, Delete Everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

```

### `client/src/components/email-templates/TemplatePreview.tsx` (38 lines)

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Eye } from "lucide-react";

interface TemplatePreviewProps {
  subject: string;
  body: string;
}

export function TemplatePreview({ subject, body }: TemplatePreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Email Preview
        </CardTitle>
        <CardDescription>
          Preview with sample data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Subject:</Label>
          <div className="p-3 bg-muted rounded-md font-medium" data-testid="preview-subject">
            {subject}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Body:</Label>
          <pre className="p-4 bg-muted rounded-md text-sm whitespace-pre-wrap font-mono overflow-auto max-h-96" data-testid="preview-body">
            {body}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

```

### `client/src/components/email-templates/constants.ts` (198 lines)

```ts
import type { EmailTemplate, TemplateKey } from "./types";

export const DEFAULT_TEMPLATES: Record<TemplateKey, EmailTemplate> = {
  service_order: {
    name: "Service Order Request",
    subject: "Service Request - {{equipment.name}} - {{vessel.name}}",
    body: `Dear {{serviceProvider.name}},

We are requesting service for the following equipment:

EQUIPMENT DETAILS
-----------------
Vessel: {{vessel.name}}
Equipment: {{equipment.name}}
Type: {{equipment.type}}
Manufacturer: {{equipment.manufacturer}}
Model: {{equipment.model}}
Serial Number: {{equipment.serialNumber}}
Location: {{equipment.location}}

SERVICE SCOPE
-------------
{{serviceOrder.scope}}

SERVICE DETAILS
---------------
{{serviceOrder.serviceDetails}}

SPECIAL REQUIREMENTS
--------------------
{{serviceOrder.specialRequirements}}

SCHEDULE
--------
Requested Start: {{serviceOrder.scheduledStartDate}}
Estimated Duration: {{serviceOrder.estimatedDurationHours}} hours

Please confirm availability and provide a quotation.

Best regards,
{{organization.name}}`,
    variables: [
      "equipment.name", "equipment.type", "equipment.manufacturer", "equipment.model",
      "equipment.serialNumber", "equipment.location", "vessel.name",
      "serviceProvider.name", "serviceOrder.scope", "serviceOrder.serviceDetails",
      "serviceOrder.specialRequirements", "serviceOrder.scheduledStartDate",
      "serviceOrder.estimatedDurationHours", "organization.name"
    ],
  },
  replacement_quote: {
    name: "Replacement Quote Request",
    subject: "Equipment Replacement Quote Request - {{equipment.name}} - {{vessel.name}}",
    body: `Dear {{serviceProvider.name}},

We are requesting a quotation for equipment replacement on behalf of {{organization.name}}.

EQUIPMENT TO BE REPLACED
------------------------
Vessel: {{vessel.name}}
Equipment: {{equipment.name}}
Type: {{equipment.type}}
Manufacturer: {{equipment.manufacturer}}
Model: {{equipment.model}}
Serial Number: {{equipment.serialNumber}}
Install Date: {{equipment.purchaseDate}}
Current Value: {{equipment.purchaseValue}} {{equipment.purchaseCurrency}}
Location: {{equipment.location}}

REPLACEMENT JUSTIFICATION
-------------------------
{{serviceOrder.justification}}

QUOTE REQUIREMENTS
------------------
Urgency: {{serviceOrder.urgency}}
Acceptable Downtime Window: {{serviceOrder.downtimeWindowStart}} to {{serviceOrder.downtimeWindowEnd}}
Budget Range: {{serviceOrder.budgetMin}} - {{serviceOrder.budgetMax}} {{serviceOrder.currency}}

PLEASE PROVIDE
--------------
1. Itemized quote (equipment, labor, shipping)
2. Warranty terms and duration
3. Estimated lead time for delivery
4. Installation support availability

Response requested by: {{serviceOrder.responseDeadline}}

Best regards,
{{organization.name}}`,
    variables: [
      "equipment.name", "equipment.type", "equipment.manufacturer", "equipment.model",
      "equipment.serialNumber", "equipment.location", "equipment.purchaseDate",
      "equipment.purchaseValue", "equipment.purchaseCurrency", "vessel.name",
      "serviceProvider.name", "serviceOrder.justification", "serviceOrder.urgency",
      "serviceOrder.downtimeWindowStart", "serviceOrder.downtimeWindowEnd",
      "serviceOrder.budgetMin", "serviceOrder.budgetMax", "serviceOrder.currency",
      "serviceOrder.responseDeadline", "organization.name"
    ],
  },
  purchase_order: {
    name: "Purchase Order Request",
    subject: "Purchase Order Request - {{purchaseOrder.poNumber}}",
    body: `Dear {{supplier.name}},

We would like to place the following purchase order:

ORDER DETAILS
-------------
PO Number: {{purchaseOrder.poNumber}}
Order Date: {{purchaseOrder.orderDate}}
Requested Delivery: {{purchaseOrder.requestedDeliveryDate}}

ITEMS
-----
{{purchaseOrder.items}}

DELIVERY ADDRESS
----------------
{{organization.address}}

PAYMENT TERMS
-------------
{{purchaseOrder.paymentTerms}}

Please confirm receipt and provide expected delivery date.

Best regards,
{{organization.name}}`,
    variables: [
      "supplier.name", "purchaseOrder.poNumber", "purchaseOrder.orderDate",
      "purchaseOrder.requestedDeliveryDate", "purchaseOrder.items",
      "purchaseOrder.paymentTerms", "organization.name", "organization.address"
    ],
  },
};

export const SAMPLE_DATA = {
  equipment: {
    name: "Main Engine Seawater Pump",
    type: "Centrifugal Pump",
    manufacturer: "Alfa Laval",
    model: "SX-450",
    serialNumber: "AL-2019-78432",
    location: "Engine Room, Port Side",
    purchaseDate: "March 2019",
    purchaseValue: "22,500",
    purchaseCurrency: "USD",
  },
  vessel: { name: "MV Pacific Voyager" },
  serviceProvider: { name: "Marine Equipment Corp" },
  supplier: { name: "Parts Unlimited Inc" },
  organization: { 
    name: "Pacific Maritime Fleet",
    address: "123 Harbor Drive, Singapore 018956"
  },
  serviceOrder: {
    scope: "Full inspection and repair of seawater cooling pump",
    serviceDetails: "Replace worn bearings and seals, check impeller for corrosion",
    specialRequirements: "Must be completed during scheduled port call",
    scheduledStartDate: "January 15, 2025",
    estimatedDurationHours: "8",
    justification: "Repeated bearing failures over past 6 months despite multiple repairs. Vibration analysis indicates internal wear beyond acceptable thresholds.",
    urgency: "Urgent",
    downtimeWindowStart: "January 15, 2025",
    downtimeWindowEnd: "January 25, 2025",
    budgetMin: "15,000",
    budgetMax: "25,000",
    currency: "USD",
    responseDeadline: "January 5, 2025",
  },
  purchaseOrder: {
    poNumber: "PO-2025-001234",
    orderDate: "December 20, 2024",
    requestedDeliveryDate: "January 10, 2025",
    items: "1x Seawater Pump Bearing Kit (Part# SK-450-BRG)\n2x Mechanical Seal Set (Part# MS-450-SEAL)\n1x Impeller Assembly (Part# IMP-450-SS)",
    paymentTerms: "Net 30 days",
  },
};

export const VARIABLE_CATEGORIES: Record<string, string[]> = {
  equipment: ["equipment.name", "equipment.type", "equipment.manufacturer", "equipment.model", "equipment.serialNumber", "equipment.location", "equipment.purchaseDate", "equipment.purchaseValue", "equipment.purchaseCurrency"],
  vessel: ["vessel.name"],
  serviceProvider: ["serviceProvider.name"],
  supplier: ["supplier.name"],
  organization: ["organization.name", "organization.address"],
  serviceOrder: ["serviceOrder.scope", "serviceOrder.serviceDetails", "serviceOrder.specialRequirements", "serviceOrder.scheduledStartDate", "serviceOrder.estimatedDurationHours", "serviceOrder.justification", "serviceOrder.urgency", "serviceOrder.downtimeWindowStart", "serviceOrder.downtimeWindowEnd", "serviceOrder.budgetMin", "serviceOrder.budgetMax", "serviceOrder.currency", "serviceOrder.responseDeadline"],
  purchaseOrder: ["purchaseOrder.poNumber", "purchaseOrder.orderDate", "purchaseOrder.requestedDeliveryDate", "purchaseOrder.items", "purchaseOrder.paymentTerms"],
};

export const CATEGORY_LABELS: Record<string, string> = {
  equipment: "Equipment",
  vessel: "Vessel",
  serviceProvider: "Service Provider",
  supplier: "Supplier",
  organization: "Organization",
  serviceOrder: "Service Order",
  purchaseOrder: "Purchase Order",
};

```

### `client/src/components/email-templates/index.ts` (6 lines)

```ts
export * from "./types";
export * from "./constants";
export * from "./utils";
export { CustomVariableDialog } from "./CustomVariableDialog";
export { VariablePanel } from "./VariablePanel";
export { TemplatePreview } from "./TemplatePreview";

```

### `client/src/components/email-templates/types.ts` (20 lines)

```ts
export interface CustomVariable {
  id: string;
  orgId: string;
  name: string;
  value: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

export type TemplateKey = "service_order" | "replacement_quote" | "purchase_order";

export type TemplateField = "subject" | "body";

```

### `client/src/components/email-templates/utils.ts` (25 lines)

```ts
import { SAMPLE_DATA } from "./constants";

export function replaceVariables(template: string, data: typeof SAMPLE_DATA): string {
  let result = template;
  
  const flattenData = (obj: Record<string, unknown>, prefix = ""): Record<string, string> => {
    const flat: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        Object.assign(flat, flattenData(value as Record<string, unknown>, fullKey));
      } else {
        flat[fullKey] = String(value ?? "");
      }
    }
    return flat;
  };

  const flatData = flattenData(data);
  for (const [key, value] of Object.entries(flatData)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  
  return result;
}

```

