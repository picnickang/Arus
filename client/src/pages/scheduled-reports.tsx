import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Calendar, Mail, FileText, Clock, Play, Trash2, Edit } from 'lucide-react';

interface ReportSchedule {
  id: string;
  name: string;
  reportType: string;
  frequency: string;
  format: string;
  recipients: string[];
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

const REPORT_TYPES = [
  { id: 'fleet_health', name: 'Fleet Health Summary' },
  { id: 'maintenance_due', name: 'Maintenance Due Report' },
  { id: 'inventory_status', name: 'Inventory Status Report' },
  { id: 'crew_compliance', name: 'Crew Compliance Report' },
  { id: 'cost_summary', name: 'Cost Summary Report' },
];

const FREQUENCIES = [
  { id: 'daily', name: 'Daily' },
  { id: 'weekly', name: 'Weekly' },
  { id: 'monthly', name: 'Monthly' },
];

const FORMATS = [
  { id: 'pdf', name: 'PDF' },
  { id: 'csv', name: 'CSV' },
  { id: 'json', name: 'JSON' },
];

export default function ScheduledReports() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    reportType: 'fleet_health',
    frequency: 'weekly',
    format: 'pdf',
    recipients: '',
    enabled: true,
  });

  const { data: schedules, isLoading } = useQuery<{ data: ReportSchedule[] }>({
    queryKey: ['/api/scheduled-reports/schedules'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/scheduled-reports/schedules', {
        ...data,
        recipients: data.recipients.split(',').map((r) => r.trim()).filter(Boolean),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-reports/schedules'] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: 'Schedule created', description: 'Your report schedule has been created.' });
    },
    onError: (error) => {
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

  const resetForm = () => {
    setFormData({
      name: '',
      reportType: 'fleet_health',
      frequency: 'weekly',
      format: 'pdf',
      recipients: '',
      enabled: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getReportTypeName = (id: string) => {
    return REPORT_TYPES.find((t) => t.id === id)?.name || id;
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-scheduled-reports">
      <div className="flex items-center justify-between">
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Schedule Name</Label>
                <Input
                  id="name"
                  data-testid="input-schedule-name"
                  placeholder="Weekly Fleet Health Report"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportType">Report Type</Label>
                <Select
                  value={formData.reportType}
                  onValueChange={(v) => setFormData({ ...formData, reportType: v })}
                >
                  <SelectTrigger data-testid="select-report-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(v) => setFormData({ ...formData, frequency: v })}
                  >
                    <SelectTrigger data-testid="select-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((freq) => (
                        <SelectItem key={freq.id} value={freq.id}>
                          {freq.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="format">Format</Label>
                  <Select
                    value={formData.format}
                    onValueChange={(v) => setFormData({ ...formData, format: v })}
                  >
                    <SelectTrigger data-testid="select-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMATS.map((fmt) => (
                        <SelectItem key={fmt.id} value={fmt.id}>
                          {fmt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipients">Recipients (comma-separated emails)</Label>
                <Input
                  id="recipients"
                  data-testid="input-recipients"
                  placeholder="admin@company.com, ops@company.com"
                  value={formData.recipients}
                  onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-schedule">
                  {createMutation.isPending ? 'Creating...' : 'Create Schedule'}
                </Button>
              </DialogFooter>
            </form>
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
      ) : schedules?.data?.length === 0 ? (
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
          {schedules?.data?.map((schedule) => (
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
                    {schedule.recipients.length}
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
