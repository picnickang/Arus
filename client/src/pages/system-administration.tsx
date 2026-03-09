import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings, Users, Activity, FileText, AlertTriangle, CheckCircle, Clock, RefreshCw, Download, Upload, RotateCcw, Key, Eye, EyeOff, Beaker, Github, History, Radio, CalendarClock } from "lucide-react";
import { PerformanceHealthTab } from "@/components/admin/PerformanceHealthTab";
import { SystemSettingsTab } from "@/components/admin/SystemSettingsTab";
import { DesktopUpdatePanel } from "@/components/admin/DesktopUpdatePanel";
import { MLTestingToolsTab } from "@/components/admin/MLTestingToolsTab";
import { AuditTrailTab } from "@/components/admin/AuditTrailTab";
import { ConfigAuditLogTab } from "@/components/admin/ConfigAuditLogTab";
import { SchedulingSettingsTab } from "@/components/admin/SchedulingSettingsTab";
import { TelemetryHealthMonitor } from "@/features/telemetry/components/TelemetryHealthMonitor";
import SyncAdmin from "@/components/SyncAdmin";
import { useSystemAdminData, useSoftwareUpdatesData, useGitHubSettingsData, useConfigurationTabData } from "@/features/settings";
import type { SoftwarePatch } from "@shared/schema";
import { formatDate } from "@/lib/formatters";
import { PermissionGate } from "@/components/PermissionGate";

function GitHubSettingsTab() {
  const g = useGitHubSettingsData();
  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Github className="h-5 w-5" />GitHub Connection</CardTitle><CardDescription>GitHub is connected via Replit integration for accessing releases</CardDescription></CardHeader><CardContent>
        {g.githubLoading ? <div className="flex items-center gap-4 p-4 border rounded-lg animate-pulse"><div className="h-10 w-10 bg-muted rounded-full" /><div className="space-y-2"><div className="h-4 w-32 bg-muted rounded" /><div className="h-3 w-48 bg-muted rounded" /></div></div> :
        g.githubStatus?.connected ? <div className="flex items-center gap-4 p-4 border border-green-500/50 bg-green-500/10 rounded-lg">{g.githubStatus.user?.avatar_url && <img src={g.githubStatus.user.avatar_url} alt={g.githubStatus.user.login} loading="lazy" className="h-10 w-10 rounded-full" />}<div className="flex-1"><div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /><span className="font-medium text-green-700 dark:text-green-400">Connected</span></div><p className="text-sm text-muted-foreground">Signed in as <strong>{g.githubStatus.user?.login}</strong>{g.githubStatus.user?.name && ` (${g.githubStatus.user.name})`}</p></div></div> :
        <div className="space-y-4"><div className="flex items-center gap-4 p-4 border border-amber-500/50 bg-amber-500/10 rounded-lg"><AlertTriangle className="h-10 w-10 text-amber-600" /><div className="flex-1"><p className="font-medium text-amber-700 dark:text-amber-400">GitHub Connection Required</p><p className="text-sm text-muted-foreground">Connect your GitHub account to enable automatic software updates for vessel deployments.</p></div></div><div className="p-4 border rounded-lg bg-muted/50"><h4 className="font-medium mb-3">How to Connect GitHub:</h4><ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2"><li>Look for the <strong>"Tools"</strong> panel on the left sidebar in Replit</li><li>Find and click <strong>"GitHub"</strong> in the integrations list</li><li>Click <strong>"Connect"</strong> and authorize access to your repositories</li><li>Return here - the connection will be detected automatically</li></ol><div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-sm"><strong className="text-blue-700 dark:text-blue-400">Why use Replit's GitHub integration?</strong><p className="text-muted-foreground mt-1">Replit securely manages your GitHub OAuth tokens with automatic refresh - no API keys to store or rotate manually.</p></div></div></div>}
      </CardContent></Card>
      {g.githubStatus?.connected && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Release Repository</CardTitle><CardDescription>Select which GitHub repository to monitor for Tauri desktop app updates</CardDescription></CardHeader><CardContent className="space-y-4">
        {g.settings?.githubOwner && g.settings?.githubRepo && <div className="flex items-center gap-2 p-3 bg-muted rounded-lg"><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-sm">Currently monitoring: <strong>{g.settings.githubOwner}/{g.settings.githubRepo}</strong></span></div>}
        {g.reposLoading ? <div className="text-sm text-muted-foreground">Loading repositories...</div> : g.reposData?.repos?.length ? <div className="space-y-2"><Label>Select a repository:</Label><div className="grid gap-2 max-h-60 overflow-y-auto">{g.reposData.repos.map((repo) => <Button key={repo.id} variant={g.settings?.githubRepo === repo.name && g.settings?.githubOwner === repo.owner ? "default" : "outline"} className="justify-start h-auto py-3" onClick={() => g.selectRepoMutation.mutate({ owner: repo.owner, repo: repo.name })} disabled={g.selectRepoMutation.isPending} data-testid={`button-select-repo-${repo.name}`}><Github className="mr-2 h-4 w-4" /><div className="text-left"><div className="font-medium">{repo.full_name}</div><div className="text-xs text-muted-foreground">{repo.html_url}</div></div></Button>)}</div></div> : <div className="text-sm text-muted-foreground">No repositories found. Make sure your GitHub account has accessible repositories.</div>}
      </CardContent></Card>}
      <Card><CardHeader><CardTitle className="text-base">How GitHub Releases Work</CardTitle></CardHeader><CardContent><ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2"><li>GitHub is connected via Replit integration (automatic token management)</li><li>Select which repository to monitor for releases above</li><li>Build your Tauri desktop app with tauri:build</li><li>Publish releases to GitHub - desktop apps will automatically update</li></ol></CardContent></Card>
    </div>
  );
}

function SoftwareUpdatesTab() {
  const s = useSoftwareUpdatesData();
  if (s.isDesktopEnv) {return <div className="space-y-6"><DesktopUpdatePanel /></div>;}
  if (s.isLoading) {return <div className="flex items-center justify-center py-8" data-testid="loading-software-updates">Loading software updates...</div>;}
  if (s.hasError) {return <div className="space-y-4"><div className="flex items-center justify-between"><div><h3 className="text-lg font-medium">Software Updates</h3><p className="text-sm text-muted-foreground">Manage system updates, patches, and auto-update configuration</p></div></div><Card className="border-destructive" data-testid="error-software-updates"><CardHeader><CardTitle className="text-destructive">Failed to Load Updates</CardTitle><CardDescription>Unable to retrieve software update information. Please check your connection or admin permissions.</CardDescription></CardHeader><CardContent><div className="space-y-2 text-sm">{s.errors.patches && <p data-testid="error-patches">Patches: {s.errors.patches}</p>}{s.errors.history && <p data-testid="error-history">History: {s.errors.history}</p>}{s.errors.settings && <p data-testid="error-settings">Settings: {s.errors.settings}</p>}</div></CardContent></Card></div>;}

  return (
    <div className="space-y-6">
      <DesktopUpdatePanel />
      <div className="flex items-center justify-between"><div><h3 className="text-lg font-medium" data-testid="heading-software-updates">Server Patch Management</h3><p className="text-sm text-muted-foreground">Manage server-side updates, patches, and auto-update configuration</p></div><Button variant="outline" onClick={() => s.checkUpdatesMutation.mutate()} disabled={s.checkUpdatesMutation.isPending} data-testid="button-check-updates"><RefreshCw className={`mr-2 h-4 w-4 ${s.checkUpdatesMutation.isPending ? "animate-spin" : ""}`} />Check for Updates</Button></div>
      <Tabs defaultValue="available" className="space-y-4">
        <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground"><TabsTrigger value="available" data-testid="tab-available-updates">Available Updates</TabsTrigger><TabsTrigger value="publish" data-testid="tab-publish-update"><Upload className="mr-2 h-4 w-4" />Publish Update</TabsTrigger><TabsTrigger value="github" data-testid="tab-github-releases"><Github className="mr-2 h-4 w-4" />GitHub</TabsTrigger><TabsTrigger value="settings" data-testid="tab-update-settings">Auto-Update Settings</TabsTrigger></TabsList>
        <TabsContent value="available" className="space-y-4">
          <Card data-testid="card-available-updates"><CardHeader><CardTitle>Available Updates</CardTitle><CardDescription>Software patches ready for download and installation</CardDescription></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Version</TableHead><TableHead>From</TableHead><TableHead>Severity</TableHead><TableHead>Status</TableHead><TableHead>Size</TableHead><TableHead>Released</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>
            {(s.patches ?? []).filter((p: SoftwarePatch) => p.status === "available").map((patch: SoftwarePatch) => <TableRow key={patch.id} data-testid={`row-patch-${patch.id}`}><TableCell className="font-medium" data-testid={`text-version-${patch.id}`}>{patch.version}</TableCell><TableCell data-testid={`text-from-version-${patch.id}`}>{patch.fromVersion}</TableCell><TableCell><Badge variant={s.getSeverityColor(patch.severity) as "default" | "secondary" | "destructive" | "outline"} data-testid={`badge-severity-${patch.id}`}>{patch.severity}</Badge></TableCell><TableCell><Badge variant={s.getStatusColor(patch.status) as "default" | "secondary" | "destructive" | "outline"} data-testid={`badge-status-${patch.id}`}>{patch.status}</Badge></TableCell><TableCell data-testid={`text-size-${patch.id}`}>{patch.fileSize ? `${(patch.fileSize / 1024 / 1024).toFixed(2)} MB` : "N/A"}</TableCell><TableCell data-testid={`text-released-${patch.id}`}>{patch.createdAt ? new Date(patch.createdAt).toLocaleDateString() : "N/A"}</TableCell><TableCell><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => s.downloadMutation.mutate(patch.id)} disabled={s.downloadMutation.isPending} data-testid={`button-download-${patch.id}`}><Download className="h-4 w-4" /></Button><Button size="sm" onClick={() => s.setSelectedPatch(patch)} data-testid={`button-details-${patch.id}`}>Details</Button></div></TableCell></TableRow>)}
            {(!s.patches || s.patches.filter((p: SoftwarePatch) => p.status === "available").length === 0) && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground" data-testid="empty-available-updates"><CheckCircle className="mx-auto h-12 w-12 mb-2 text-green-500" /><p>System is up to date. No updates available.</p></TableCell></TableRow>}
          </TableBody></Table></CardContent></Card>
          <Card data-testid="card-patch-history"><CardHeader><CardTitle>Patch History</CardTitle><CardDescription>Previously applied patches and rollback points</CardDescription></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead>Applied At</TableHead><TableHead>Applied By</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>
            {(s.patchHistory ?? []).slice(0, 10).map((patch: SoftwarePatch) => <TableRow key={patch.id} data-testid={`row-history-${patch.id}`}><TableCell className="font-medium" data-testid={`text-history-version-${patch.id}`}>{patch.version}</TableCell><TableCell><Badge variant={s.getStatusColor(patch.status) as "default" | "secondary" | "destructive" | "outline"} data-testid={`badge-history-status-${patch.id}`}>{patch.status}</Badge></TableCell><TableCell data-testid={`text-applied-at-${patch.id}`}>{patch.appliedAt ? formatDate(patch.appliedAt) : "N/A"}</TableCell><TableCell data-testid={`text-applied-by-${patch.id}`}>{patch.appliedBy || "System"}</TableCell><TableCell>{patch.status === "applied" && patch.backupId && <Button size="sm" variant="outline" onClick={() => s.rollbackMutation.mutate(patch.backupId)} disabled={s.rollbackMutation.isPending} data-testid={`button-rollback-${patch.id}`}><RotateCcw className="mr-2 h-4 w-4" />Rollback</Button>}</TableCell></TableRow>)}
            {(!s.patchHistory || s.patchHistory.length === 0) && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground" data-testid="empty-patch-history">No patch history available.</TableCell></TableRow>}
          </TableBody></Table></CardContent></Card>
        </TabsContent>
        <TabsContent value="publish" className="space-y-4">
          <Card data-testid="card-publish-update"><CardHeader><CardTitle>Publish Software Update</CardTitle><CardDescription>Create and publish a new patch to GitHub Releases. Patches are automatically detected from git commits.</CardDescription></CardHeader><CardContent>
            <Form {...s.publishForm}><form onSubmit={s.publishForm.handleSubmit(s.onPublishSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={s.publishForm.control} name="fromVersion" render={({ field }) => <FormItem><FormLabel>From Version</FormLabel><FormControl><Input placeholder="1.0" {...field} data-testid="input-from-version" /></FormControl><FormDescription>Source version (must be a git tag)</FormDescription><FormMessage /></FormItem>} />
                <FormField control={s.publishForm.control} name="version" render={({ field }) => <FormItem><FormLabel>New Version</FormLabel><FormControl><Input placeholder="1.0.1" {...field} data-testid="input-version" /></FormControl><FormDescription>Target version (will create git tag)</FormDescription><FormMessage /></FormItem>} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={s.publishForm.control} name="severity" render={({ field }) => <FormItem><FormLabel>Severity</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger data-testid="select-severity"><SelectValue placeholder="Select severity" /></SelectTrigger></FormControl><SelectContent><SelectItem value="critical">Critical</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
                <FormField control={s.publishForm.control} name="channel" render={({ field }) => <FormItem><FormLabel>Release Channel</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger data-testid="select-channel"><SelectValue placeholder="Select channel" /></SelectTrigger></FormControl><SelectContent><SelectItem value="stable">Stable</SelectItem><SelectItem value="beta">Beta</SelectItem><SelectItem value="alpha">Alpha</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
                <FormField control={s.publishForm.control} name="patchType" render={({ field }) => <FormItem><FormLabel>Patch Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger data-testid="select-patch-type"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent><SelectItem value="incremental">Incremental</SelectItem><SelectItem value="full">Full</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
              </div>
              <FormField control={s.publishForm.control} name="requiresRestart" render={({ field }) => <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Requires System Restart</FormLabel><FormDescription>Check if the patch requires a full system restart to apply</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-requires-restart" /></FormControl></FormItem>} />
              <FormField control={s.publishForm.control} name="releaseNotes" render={({ field }) => <FormItem><FormLabel>Release Notes</FormLabel><FormControl><Textarea placeholder="Describe the changes in this update..." className="min-h-[120px]" {...field} data-testid="textarea-release-notes" /></FormControl><FormDescription>Detailed description of changes (supports Markdown)</FormDescription><FormMessage /></FormItem>} />
              <div className="flex gap-2"><Button type="submit" disabled={s.publishMutation.isPending} data-testid="button-publish-patch">{s.publishMutation.isPending ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Publishing...</> : <><Upload className="mr-2 h-4 w-4" />Publish to GitHub</>}</Button><Button type="button" variant="outline" onClick={s.handlePreview} disabled={s.previewMutation.isPending} data-testid="button-preview-patch">{s.previewMutation.isPending ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Loading...</> : "Preview Changes"}</Button></div>
            </form></Form>
            {s.previewMutation.data && <div className="mt-6 p-4 border rounded-lg bg-muted/50" data-testid="preview-results"><h4 className="font-semibold mb-3">Patch Preview</h4><div className="grid grid-cols-3 gap-4 text-sm mb-4"><div><span className="text-muted-foreground">Files Changed:</span><p className="font-medium">{(s.previewMutation.data as {filesChanged?: number}).filesChanged ?? 0}</p></div><div><span className="text-muted-foreground">Additions:</span><p className="font-medium text-green-600">+{(s.previewMutation.data as {additions?: number}).additions ?? 0}</p></div><div><span className="text-muted-foreground">Deletions:</span><p className="font-medium text-red-600">-{(s.previewMutation.data as {deletions?: number}).deletions ?? 0}</p></div></div>{(s.previewMutation.data as {commits?: Array<{sha: string; message: string}>}).commits && <div className="space-y-2"><span className="text-sm text-muted-foreground">Commits:</span>{(s.previewMutation.data as {commits: Array<{sha: string; message: string}>}).commits.slice(0, 5).map((c) => <div key={c.sha} className="flex items-start gap-2 text-sm p-2 bg-background rounded"><span className="font-mono text-muted-foreground">{c.sha.substring(0, 7)}</span><span className="flex-1 truncate">{c.message}</span></div>)}</div>}</div>}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="github" className="space-y-4"><GitHubSettingsTab /></TabsContent>
        <TabsContent value="settings" className="space-y-4"><Card><CardHeader><CardTitle>Auto-Update Configuration</CardTitle><CardDescription>Configure automatic update behavior for server deployments</CardDescription></CardHeader><CardContent><div className="text-center py-8 text-muted-foreground"><Clock className="mx-auto h-12 w-12 mb-4 opacity-50" /><p>Auto-update configuration coming soon</p><p className="text-sm mt-2">Configure maintenance windows and automatic patch deployment</p></div></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}

function ConfigurationTab() {
  const c = useConfigurationTabData();
  return (
    <div className="space-y-4">
      <SystemSettingsTab />
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />User Access & Security</CardTitle><CardDescription>Manage user permissions and authentication settings</CardDescription></CardHeader><CardContent className="space-y-6">
        <div className="pb-4 border-b"><div className="flex items-center justify-center py-6"><div className="text-center space-y-2"><Users className="mx-auto h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground max-w-md">User roles and permissions management coming soon.</p></div></div></div>
        <Collapsible open={c.passwordSectionOpen} onOpenChange={c.setPasswordSectionOpen}>
          <div className="flex items-center justify-between"><div className="flex items-center space-x-2"><Key className="h-4 w-4 text-muted-foreground" /><h4 className="text-sm font-semibold">Change Admin Password</h4></div><CollapsibleTrigger asChild><Button variant="ghost" size="sm" data-testid="button-toggle-password-change">{c.passwordSectionOpen ? "Cancel" : "Change Password"}</Button></CollapsibleTrigger></div>
          <CollapsibleContent className="pt-4">
            <Form {...c.passwordForm}><form onSubmit={c.passwordForm.handleSubmit(c.handlePasswordSubmit)} className="space-y-4">
              <FormField control={c.passwordForm.control} name="currentPassword" render={({ field }) => <FormItem><FormLabel>Current Password</FormLabel><FormControl><Input type="password" placeholder="Enter current password" data-testid="input-current-password" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={c.passwordForm.control} name="newPassword" render={({ field }) => <FormItem><FormLabel>New Password</FormLabel><FormControl><div className="relative"><Input type={c.showPassword ? "text" : "password"} placeholder="Enter new password" data-testid="input-new-password" {...field} /><Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => c.setShowPassword(!c.showPassword)} data-testid="button-toggle-password-visibility">{c.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></FormControl><FormDescription>Must be at least 8 characters with uppercase, lowercase, and number</FormDescription><FormMessage /></FormItem>} />
              <FormField control={c.passwordForm.control} name="confirmPassword" render={({ field }) => <FormItem><FormLabel>Confirm New Password</FormLabel><FormControl><Input type={c.showPassword ? "text" : "password"} placeholder="Confirm new password" data-testid="input-confirm-password" {...field} /></FormControl><FormMessage /></FormItem>} />
              <div className="flex justify-end space-x-2 pt-2"><Button type="button" variant="outline" onClick={c.cancelPasswordChange} data-testid="button-cancel-password-change">Cancel</Button><Button type="submit" disabled={c.changePasswordMutation.isPending} data-testid="button-submit-password-change">{c.changePasswordMutation.isPending ? "Updating..." : "Update Password"}</Button></div>
            </form></Form>
          </CollapsibleContent>
        </Collapsible>
      </CardContent></Card>
    </div>
  );
}

function UpdatesMaintenanceTab() {
  const [updateSubTab, setUpdateSubTab] = useState("software");
  return (
    <div className="space-y-4">
      <Tabs value={updateSubTab} onValueChange={setUpdateSubTab} className="space-y-4">
        <TabsList data-testid="tabs-update-maintenance"><TabsTrigger value="software" data-testid="tab-software"><Download className="mr-2 h-4 w-4" />Software Updates</TabsTrigger><TabsTrigger value="sync" data-testid="tab-sync"><RefreshCw className="mr-2 h-4 w-4" />Synchronization</TabsTrigger></TabsList>
        <TabsContent value="software" className="space-y-4"><SoftwareUpdatesTab /></TabsContent>
        <TabsContent value="sync" className="space-y-4"><SyncAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}

function MonitoringHealthTab() {
  const [monitoringSubTab, setMonitoringSubTab] = useState("performance");
  return (
    <div className="space-y-4">
      <Tabs value={monitoringSubTab} onValueChange={setMonitoringSubTab} className="space-y-4">
        <TabsList data-testid="tabs-monitoring-health"><TabsTrigger value="performance" data-testid="tab-performance"><Activity className="mr-2 h-4 w-4" />System Performance</TabsTrigger><TabsTrigger value="telemetry" data-testid="tab-telemetry"><Radio className="mr-2 h-4 w-4" />Telemetry Pipeline</TabsTrigger></TabsList>
        <TabsContent value="performance" className="space-y-4"><PerformanceHealthTab /></TabsContent>
        <TabsContent value="telemetry" className="space-y-4"><TelemetryHealthMonitor /></TabsContent>
      </Tabs>
    </div>
  );
}

function AuditComplianceTab() {
  const [auditSubTab, setAuditSubTab] = useState("activity");
  return (
    <div className="space-y-4">
      <Tabs value={auditSubTab} onValueChange={setAuditSubTab} className="space-y-4">
        <TabsList data-testid="tabs-audit-compliance"><TabsTrigger value="activity" data-testid="tab-activity-log"><FileText className="mr-2 h-4 w-4" />Activity Log</TabsTrigger><TabsTrigger value="config" data-testid="tab-config-changes"><History className="mr-2 h-4 w-4" />Configuration Changes</TabsTrigger></TabsList>
        <TabsContent value="activity" className="space-y-4"><AuditTrailTab /></TabsContent>
        <TabsContent value="config" className="space-y-4"><ConfigAuditLogTab /></TabsContent>
      </Tabs>
    </div>
  );
}

export default function SystemAdministration() {
  const { activeTab, setActiveTab } = useSystemAdminData();

  return (
    <div className="min-h-screen">
      <div className="container mx-auto py-6 space-y-8">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="w-full overflow-x-auto"><TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground w-max min-w-full"><TabsTrigger value="configuration" data-testid="tab-configuration" className="whitespace-nowrap"><Settings className="mr-2 h-4 w-4" />Configuration</TabsTrigger><TabsTrigger value="scheduling" data-testid="tab-scheduling" className="whitespace-nowrap"><CalendarClock className="mr-2 h-4 w-4" />Scheduling</TabsTrigger><TabsTrigger value="updates-maintenance" data-testid="tab-updates-maintenance" className="whitespace-nowrap"><Download className="mr-2 h-4 w-4" />Updates & Maintenance</TabsTrigger><TabsTrigger value="monitoring-health" data-testid="tab-monitoring-health" className="whitespace-nowrap"><Activity className="mr-2 h-4 w-4" />Monitoring & Health</TabsTrigger><TabsTrigger value="audit-compliance" data-testid="tab-audit-compliance" className="whitespace-nowrap"><FileText className="mr-2 h-4 w-4" />Audit & Compliance</TabsTrigger><TabsTrigger value="ml-testing" data-testid="tab-ml-testing" className="whitespace-nowrap"><Beaker className="mr-2 h-4 w-4" />ML & Testing Tools</TabsTrigger></TabsList></div>
        <TabsContent value="configuration" className="space-y-4"><ConfigurationTab /></TabsContent>
        <TabsContent value="scheduling" className="space-y-4"><SchedulingSettingsTab /></TabsContent>
        <TabsContent value="updates-maintenance" className="space-y-4"><UpdatesMaintenanceTab /></TabsContent>
        <TabsContent value="monitoring-health" className="space-y-4"><MonitoringHealthTab /></TabsContent>
        <TabsContent value="audit-compliance" className="space-y-4"><AuditComplianceTab /></TabsContent>
        <TabsContent value="ml-testing" className="space-y-4"><MLTestingToolsTab /></TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
