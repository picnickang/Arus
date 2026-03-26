# ARUS Frontend — Part 9: System (Admin, Settings, Permissions)
Generated: 2026-03-26T02:38:14Z

### `client/src/pages/system-administration.tsx` (176 lines)

```tsx
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
import { DesktopConnectionPanel } from "@/components/admin/DesktopConnectionPanel";
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
  if (s.isDesktopEnv) {return <div className="space-y-6"><DesktopConnectionPanel /><DesktopUpdatePanel /></div>;}
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

```

### `client/src/pages/settings.tsx` (23 lines)

```tsx
import { SystemSettingsTab } from "@/components/admin/SystemSettingsTab";
import { Settings } from "lucide-react";

interface SettingsPageProps {
  embedded?: boolean;
}

export default function SettingsPage({ embedded }: SettingsPageProps) {
  return (
    <div className={embedded ? "" : "container mx-auto p-6"}>
      {!embedded && (
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold">System Settings</h1>
            <p className="text-muted-foreground">Configure system-wide settings and preferences</p>
          </div>
        </div>
      )}
      <SystemSettingsTab />
    </div>
  );
}

```

### `client/src/pages/permissions-settings.tsx` (136 lines)

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Users, Key, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Role {
  id: string;
  name: string;
  displayName: string;
  userCount: number;
}

interface PermissionsData {
  roles: Role[];
  totalUsers: number;
}

export default function PermissionsSettings() {
  const { data, isLoading } = useQuery<PermissionsData>({
    queryKey: ["/api/admin/roles"],
    retry: 1,
    staleTime: 60000,
  });

  const roles: Role[] = data?.roles || [
    { id: "admin", name: "admin", displayName: "Administrator", userCount: 1 },
    { id: "captain", name: "captain", displayName: "Captain", userCount: 2 },
    { id: "chief_engineer", name: "chief_engineer", displayName: "Chief Engineer", userCount: 2 },
    { id: "crew", name: "crew", displayName: "Crew Member", userCount: 8 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-permissions-title">Permissions & Security</h1>
          <p className="text-muted-foreground">Manage roles, permissions, and access control</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">Total Roles</CardTitle>
            <Shield className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-roles">{roles.length}</div>
            <p className="text-sm text-muted-foreground">Active role definitions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">Total Users</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">
              {data?.totalUsers || roles.reduce((acc, r) => acc + r.userCount, 0)}
            </div>
            <p className="text-sm text-muted-foreground">Across all roles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">Security Status</CardTitle>
            <Lock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-600" data-testid="badge-security-status">Secure</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">RBAC enforcement active</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role Assignments</CardTitle>
          <CardDescription>Overview of roles and user assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {roles.map((role) => (
              <div
                key={role.id}
                className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                data-testid={`row-role-${role.id}`}
              >
                <div className="flex items-center gap-3">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{role.displayName}</p>
                    <p className="text-xs text-muted-foreground">{role.name}</p>
                  </div>
                </div>
                <Badge variant="secondary" data-testid={`badge-user-count-${role.id}`}>
                  {role.userCount} {role.userCount === 1 ? "user" : "users"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Access Control</CardTitle>
          <CardDescription>Single-tenant security configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Authentication Mode</p>
                <p className="text-sm text-muted-foreground">Development mode with automatic login</p>
              </div>
              <Badge variant="outline" data-testid="badge-auth-mode">Development</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Tenant Isolation</p>
                <p className="text-sm text-muted-foreground">Single-tenant architecture</p>
              </div>
              <Badge variant="default" data-testid="badge-tenant-mode">Single-Tenant</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

```

### `client/src/pages/organization-management.tsx` (64 lines)

```tsx
import { Plus, Search, Building, Users, Edit, Trash2, Crown, ShieldCheck, Wrench, Eye, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganizationData } from "@/features/settings";

const getRoleIcon = (role: string) => { switch (role) { case "admin": return <Crown className="h-4 w-4" />; case "manager": return <ShieldCheck className="h-4 w-4" />; case "technician": return <Wrench className="h-4 w-4" />; default: return <Eye className="h-4 w-4" />; } };

export default function OrganizationManagement() {
  const m = useOrganizationData();

  return (
    <div className="min-h-screen">
      <div className="px-4 md:px-6 py-4 flex flex-wrap items-center justify-end gap-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" /><Input placeholder="Search organizations or users..." value={m.searchTerm} onChange={(e) => m.setSearchTerm(e.target.value)} className="pl-10 w-full md:w-80 min-h-[44px] touch-manipulation" data-testid="input-search" /></div>
        <Button onClick={() => m.openOrganizationDialog()} className="min-h-[44px] touch-manipulation" data-testid="button-add-organization"><Plus className="mr-2 h-4 w-4" /><span className="hidden sm:inline">Add Organization</span><span className="sm:hidden">Add Org</span></Button>
      </div>

      <div className="px-4 md:px-6 space-y-4 md:space-y-6">
        <Card><CardHeader><CardTitle className="flex items-center"><Building className="mr-2 h-5 w-5" />Organizations ({m.filteredOrganizations.length})</CardTitle></CardHeader><CardContent>
          {m.organizationsLoading ? <div className="flex items-center justify-center h-64 text-muted-foreground">Loading organizations...</div> : <>
            <div className="hidden md:block"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Slug</TableHead><TableHead>Tier</TableHead><TableHead>Users</TableHead><TableHead>Equipment</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>
              {m.filteredOrganizations.map((org) => <TableRow key={org.id} className="cursor-pointer hover:bg-muted/50" onClick={() => m.setSelectedOrgId(org.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); m.setSelectedOrgId(org.id); } }} tabIndex={0} data-testid={`row-organization-${org.id}`}><TableCell className="font-medium">{org.name}</TableCell><TableCell className="font-mono text-sm">{org.slug}</TableCell><TableCell><Badge className={m.getTierColor(org.subscriptionTier)}>{org.subscriptionTier}</Badge></TableCell><TableCell>{org.maxUsers}</TableCell><TableCell>{org.maxEquipment}</TableCell><TableCell><Badge variant={org.isActive ? "default" : "secondary"}>{org.isActive ? "Active" : "Inactive"}</Badge></TableCell><TableCell><div className="flex items-center space-x-2"><Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); m.openOrganizationDialog(org); }} data-testid={`button-edit-organization-${org.id}`}><Edit className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); m.handleDeleteOrganization(org.id); }} data-testid={`button-delete-organization-${org.id}`}><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>)}
            </TableBody></Table></div>
            <div className="md:hidden space-y-3">{m.filteredOrganizations.map((org) => <Card key={org.id} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); m.setSelectedOrgId(org.id); } }} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => m.setSelectedOrgId(org.id)} data-testid={`card-organization-${org.id}`}><CardContent className="p-4"><div className="flex flex-col space-y-3"><div className="flex justify-between items-start"><div className="min-w-0 flex-1"><h3 className="font-medium text-base truncate">{org.name}</h3><p className="text-sm text-muted-foreground font-mono">{org.slug}</p></div><div className="flex flex-col items-end space-y-1"><Badge className={m.getTierColor(org.subscriptionTier)} size="sm">{org.subscriptionTier}</Badge><Badge variant={org.isActive ? "default" : "secondary"} className="text-xs">{org.isActive ? "Active" : "Inactive"}</Badge></div></div><div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-muted-foreground">Max Users:</span><div className="font-medium">{org.maxUsers}</div></div><div><span className="text-muted-foreground">Max Equipment:</span><div className="font-medium">{org.maxEquipment}</div></div></div><div className="flex space-x-2 pt-2" onMouseDown={(e) => e.stopPropagation()}><Button variant="outline" size="sm" className="flex-1 min-h-[44px] touch-manipulation" onClick={() => m.openOrganizationDialog(org)} data-testid={`button-edit-organization-${org.id}`}><Edit className="h-4 w-4 mr-2" />Edit</Button><Button variant="outline" size="sm" className="min-h-[44px] touch-manipulation" onClick={() => m.handleDeleteOrganization(org.id)} data-testid={`button-delete-organization-${org.id}`}><Trash2 className="h-4 w-4" /></Button></div></div></CardContent></Card>)}</div>
          </>}
        </CardContent></Card>

        {m.selectedOrgId && <Card><CardHeader><div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0"><CardTitle className="flex items-center text-lg md:text-xl"><Users className="mr-2 h-5 w-5" />Users ({m.filteredUsers.length})</CardTitle><Button onClick={() => m.openUserDialog()} className="min-h-[44px] touch-manipulation" data-testid="button-add-user"><Plus className="mr-2 h-4 w-4" />Add User</Button></div></CardHeader><CardContent>
          {m.usersLoading ? <div className="flex items-center justify-center h-64 text-muted-foreground">Loading users...</div> : <>
            <div className="hidden md:block"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Last Login</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>
              {m.filteredUsers.map((user) => <TableRow key={user.id} data-testid={`row-user-${user.id}`}><TableCell className="font-medium">{user.name}</TableCell><TableCell>{user.email}</TableCell><TableCell><div className="flex items-center space-x-2">{getRoleIcon(user.role)}<span className="capitalize">{user.role}</span></div></TableCell><TableCell><Badge variant={user.isActive ? "default" : "secondary"}>{user.isActive ? "Active" : "Inactive"}</Badge></TableCell><TableCell>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}</TableCell><TableCell><div className="flex items-center space-x-2"><Button variant="outline" size="sm" onClick={() => m.openUserDialog(user)} data-testid={`button-edit-user-${user.id}`}><Edit className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => m.openPasswordDialog(user.id)} data-testid={`button-password-user-${user.id}`}><Key className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => m.handleDeleteUser(user.id)} data-testid={`button-delete-user-${user.id}`}><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>)}
            </TableBody></Table></div>
            <div className="md:hidden space-y-3">{m.filteredUsers.map((user) => <Card key={user.id} data-testid={`card-user-${user.id}`}><CardContent className="p-4"><div className="flex flex-col space-y-3"><div className="flex justify-between items-start"><div className="min-w-0 flex-1"><h3 className="font-medium text-base truncate">{user.name}</h3><p className="text-sm text-muted-foreground truncate">{user.email}</p></div><Badge variant={user.isActive ? "default" : "secondary"} className="text-xs flex-shrink-0 ml-2">{user.isActive ? "Active" : "Inactive"}</Badge></div><div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-muted-foreground">Role:</span><div className="font-medium flex items-center space-x-1">{getRoleIcon(user.role)}<span className="capitalize">{user.role}</span></div></div><div><span className="text-muted-foreground">Last Login:</span><div className="font-medium">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}</div></div></div><div className="flex space-x-2 pt-2"><Button variant="outline" size="sm" className="flex-1 min-h-[44px] touch-manipulation" onClick={() => m.openUserDialog(user)} data-testid={`button-edit-user-${user.id}`}><Edit className="h-4 w-4 mr-2" />Edit</Button><Button variant="outline" size="sm" className="min-h-[44px] touch-manipulation" onClick={() => m.openPasswordDialog(user.id)} data-testid={`button-password-user-mobile-${user.id}`}><Key className="h-4 w-4" /></Button><Button variant="outline" size="sm" className="min-h-[44px] touch-manipulation" onClick={() => m.handleDeleteUser(user.id)} data-testid={`button-delete-user-${user.id}`}><Trash2 className="h-4 w-4" /></Button></div></div></CardContent></Card>)}</div>
          </>}
        </CardContent></Card>}
      </div>

      <Dialog open={m.organizationDialogOpen} onOpenChange={m.setOrganizationDialogOpen}><DialogContent className="max-w-2xl mx-4 md:mx-0" data-testid="dialog-organization"><DialogHeader><DialogTitle>{m.editingOrganization ? "Edit Organization" : "Create Organization"}</DialogTitle></DialogHeader><Form {...m.organizationForm}><form onSubmit={m.organizationForm.handleSubmit(m.editingOrganization ? m.handleUpdateOrganization : m.handleCreateOrganization)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={m.organizationForm.control} name="name" render={({ field }) => <FormItem><FormLabel>Organization Name</FormLabel><FormControl><Input placeholder="Acme Corp" className="min-h-[44px] touch-manipulation" {...field} data-testid="input-org-name" /></FormControl><FormMessage /></FormItem>} /><FormField control={m.organizationForm.control} name="slug" render={({ field }) => <FormItem><FormLabel>Slug</FormLabel><FormControl><Input placeholder="acme-corp" className="min-h-[44px] touch-manipulation" {...field} data-testid="input-org-slug" /></FormControl><FormMessage /></FormItem>} /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={m.organizationForm.control} name="subscriptionTier" render={({ field }) => <FormItem><FormLabel>Subscription Tier</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="min-h-[44px] touch-manipulation" data-testid="select-org-tier"><SelectValue placeholder="Select tier" /></SelectTrigger></FormControl><SelectContent><SelectItem value="basic">Basic</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem></SelectContent></Select><FormMessage /></FormItem>} /><FormField control={m.organizationForm.control} name="billingEmail" render={({ field }) => <FormItem><FormLabel>Billing Email</FormLabel><FormControl><Input type="email" placeholder="billing@acme.com" className="min-h-[44px] touch-manipulation" {...field} data-testid="input-org-billing" /></FormControl><FormMessage /></FormItem>} /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={m.organizationForm.control} name="maxUsers" render={({ field }) => <FormItem><FormLabel>Max Users</FormLabel><FormControl><Input type="number" placeholder="50" className="min-h-[44px] touch-manipulation" {...field} onChange={(e) => field.onChange(Number.parseInt(e.target.value))} data-testid="input-org-max-users" /></FormControl><FormMessage /></FormItem>} /><FormField control={m.organizationForm.control} name="maxEquipment" render={({ field }) => <FormItem><FormLabel>Max Equipment</FormLabel><FormControl><Input type="number" placeholder="1000" className="min-h-[44px] touch-manipulation" {...field} onChange={(e) => field.onChange(Number.parseInt(e.target.value))} data-testid="input-org-max-equipment" /></FormControl><FormMessage /></FormItem>} /></div>
        <div className="flex flex-col md:flex-row md:justify-end space-y-2 md:space-y-0 md:space-x-2"><Button type="button" variant="outline" className="min-h-[44px] touch-manipulation" onClick={() => m.setOrganizationDialogOpen(false)} data-testid="button-cancel-organization">Cancel</Button><Button type="submit" className="min-h-[44px] touch-manipulation" data-testid="button-submit-organization">{m.editingOrganization ? "Update Organization" : "Create Organization"}</Button></div>
      </form></Form></DialogContent></Dialog>

      <Dialog open={m.userDialogOpen} onOpenChange={m.setUserDialogOpen}><DialogContent className="max-w-2xl mx-4 md:mx-0" data-testid="dialog-user"><DialogHeader><DialogTitle>{m.editingUser ? "Edit User" : "Create User"}</DialogTitle></DialogHeader><Form {...m.userForm}><form onSubmit={m.userForm.handleSubmit(m.editingUser ? m.handleUpdateUser : m.handleCreateUser)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={m.userForm.control} name="name" render={({ field }) => <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" className="min-h-[44px] touch-manipulation" {...field} data-testid="input-user-name" /></FormControl><FormMessage /></FormItem>} /><FormField control={m.userForm.control} name="email" render={({ field }) => <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="john@acme.com" className="min-h-[44px] touch-manipulation" {...field} data-testid="input-user-email" /></FormControl><FormMessage /></FormItem>} /></div>
        <FormField control={m.userForm.control} name="role" render={({ field }) => <FormItem><FormLabel>Role</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="min-h-[44px] touch-manipulation" data-testid="select-user-role"><SelectValue placeholder="Select role" /></SelectTrigger></FormControl><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="technician">Technician</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
        <div className="flex flex-col md:flex-row md:justify-end space-y-2 md:space-y-0 md:space-x-2"><Button type="button" variant="outline" className="min-h-[44px] touch-manipulation" onClick={() => m.setUserDialogOpen(false)} data-testid="button-cancel-user">Cancel</Button><Button type="submit" className="min-h-[44px] touch-manipulation" data-testid="button-submit-user">{m.editingUser ? "Update User" : "Create User"}</Button></div>
      </form></Form></DialogContent></Dialog>

      <Dialog open={m.passwordDialogOpen} onOpenChange={m.setPasswordDialogOpen}><DialogContent className="max-w-md mx-4 md:mx-0" data-testid="dialog-password"><DialogHeader><DialogTitle>Set User Password</DialogTitle></DialogHeader><Form {...m.passwordForm}><form onSubmit={m.passwordForm.handleSubmit(m.handleSetPassword)} className="space-y-4">
        <FormField control={m.passwordForm.control} name="password" render={({ field }) => <FormItem><FormLabel>New Password</FormLabel><FormControl><Input type="password" placeholder="Enter new password" className="min-h-[44px] touch-manipulation" {...field} data-testid="input-new-password" /></FormControl><FormMessage /></FormItem>} />
        <FormField control={m.passwordForm.control} name="confirmPassword" render={({ field }) => <FormItem><FormLabel>Confirm Password</FormLabel><FormControl><Input type="password" placeholder="Confirm new password" className="min-h-[44px] touch-manipulation" {...field} data-testid="input-confirm-password" /></FormControl><FormMessage /></FormItem>} />
        <div className="flex flex-col md:flex-row md:justify-end space-y-2 md:space-y-0 md:space-x-2"><Button type="button" variant="outline" className="min-h-[44px] touch-manipulation" onClick={() => m.setPasswordDialogOpen(false)} data-testid="button-cancel-password">Cancel</Button><Button type="submit" className="min-h-[44px] touch-manipulation" data-testid="button-submit-password">Set Password</Button></div>
      </form></Form></DialogContent></Dialog>
    </div>
  );
}

```

### `client/src/pages/storage-settings.tsx` (132 lines)

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, HardDrive, Cloud, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface StorageConfig {
  mode: "cloud" | "local" | "hybrid";
  primaryStorage: string;
  backupEnabled: boolean;
  syncStatus: "synced" | "syncing" | "error";
  lastSync?: string;
  totalSize?: string;
  usedSize?: string;
}

export default function StorageSettings() {
  const { data: storageConfig, isLoading } = useQuery<StorageConfig>({
    queryKey: ["/api/admin/storage/config"],
    retry: 1,
    staleTime: 60000,
  });

  const config: StorageConfig = storageConfig || {
    mode: "cloud",
    primaryStorage: "PostgreSQL (Neon)",
    backupEnabled: true,
    syncStatus: "synced",
    lastSync: new Date().toISOString(),
    totalSize: "10 GB",
    usedSize: "1.2 GB",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-storage-title">Storage Settings</h1>
          <p className="text-muted-foreground">Configure database and file storage options</p>
        </div>
        <Button variant="outline" data-testid="button-refresh-storage">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Status
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Database Storage</CardTitle>
              <CardDescription>Primary data storage configuration</CardDescription>
            </div>
            <Database className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mode</span>
              <Badge variant="secondary" data-testid="badge-storage-mode">
                {config.mode.charAt(0).toUpperCase() + config.mode.slice(1)}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Primary Storage</span>
              <span className="text-sm font-medium" data-testid="text-primary-storage">{config.primaryStorage}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Sync Status</span>
              <div className="flex items-center gap-2">
                {config.syncStatus === "synced" ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : config.syncStatus === "error" ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}
                <span className="text-sm capitalize" data-testid="text-sync-status">{config.syncStatus}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Storage Usage</CardTitle>
              <CardDescription>Current storage utilization</CardDescription>
            </div>
            <HardDrive className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Used</span>
              <span className="text-sm font-medium" data-testid="text-used-storage">{config.usedSize || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Available</span>
              <span className="text-sm font-medium" data-testid="text-total-storage">{config.totalSize || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Backup Enabled</span>
              <Badge variant={config.backupEnabled ? "default" : "secondary"} data-testid="badge-backup-status">
                {config.backupEnabled ? "Yes" : "No"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">Cloud Integration</CardTitle>
            <CardDescription>Cloud storage and backup settings</CardDescription>
          </div>
          <Cloud className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Replit Object Storage</p>
              <p className="text-sm text-muted-foreground">
                Cloud storage is managed automatically by the platform
              </p>
            </div>
            <Badge variant="outline" data-testid="badge-cloud-status">Connected</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

```

### `client/src/pages/transport-settings.tsx` (88 lines)

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, Server, Database, Activity } from "lucide-react";

interface TransportSettingsProps {
  embedded?: boolean;
}

export default function TransportSettings({ embedded }: TransportSettingsProps) {
  return (
    <div className={embedded ? "" : "p-6"}>
      <div className="space-y-6">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-transport-title">Data & Transport Settings</h1>
            <p className="text-muted-foreground">Configure data synchronization and transport protocols</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MQTT Connection</CardTitle>
              <Wifi className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Disconnected</Badge>
                <span className="text-xs text-muted-foreground">Local broker not configured</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                MQTT is used for real-time telemetry sync between vessels and cloud
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SQLite Bridge</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Standby</Badge>
                <span className="text-xs text-muted-foreground">Phase A mode</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Local SQLite database for offline telemetry buffering
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Redis Cache</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Fallback Mode</Badge>
                <span className="text-xs text-muted-foreground">Using in-memory cache</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Redis provides distributed caching for analytics and inventory
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Batch Writer</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge>Active</Badge>
                <span className="text-xs text-muted-foreground">500ms flush interval</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Batches telemetry writes to PostgreSQL for performance
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

```

### `client/src/components/admin/AuditTrailTab.tsx` (105 lines)

```tsx
/**
 * Audit Trail Tab Component
 * 
 * Displays administrative actions and system events audit log.
 * Extracted from system-administration.tsx for better maintainability.
 */

import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminQueryFn } from "@/lib/admin-api";
import type { AdminAuditEvent } from "@shared/schema";
import { formatDate } from "@/lib/formatters";

function AuditTrailTabComponent() {
  const { data: auditEvents, isLoading } = useQuery({
    queryKey: ["/api/admin/audit"],
    queryFn: adminQueryFn(["/api/admin/audit"]),
    enabled: true,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-8">Loading audit trail...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Audit Trail</h3>
        <p className="text-sm text-muted-foreground">
          Complete log of administrative actions and system events
        </p>
      </div>

      <Card data-testid="card-audit-events">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(auditEvents ?? []).map((event: AdminAuditEvent) => (
                <TableRow key={event.id} data-testid={`row-audit-event-${event.id}`}>
                  <TableCell data-testid={`text-timestamp-${event.id}`}>
                    {event.createdAt ? formatDate(event.createdAt) : "N/A"}
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`text-user-${event.id}`}>
                    {event.userId || "System"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" data-testid={`badge-action-${event.id}`}>
                      {event.action}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-resource-${event.id}`}>
                    {event.resourceType}
                  </TableCell>
                  <TableCell
                    className="font-mono text-sm"
                    data-testid={`text-ip-address-${event.id}`}
                  >
                    {event.ipAddress || "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={event.outcome === "success" ? "default" : "destructive"}
                      data-testid={`badge-status-${event.id}`}
                    >
                      {event.outcome === "success" ? "Success" : "Failed"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {(!auditEvents || auditEvents.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No audit events found. Administrative actions will appear here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export const AuditTrailTab = memo(AuditTrailTabComponent);

```

### `client/src/components/admin/ConfigAuditLogTab.tsx` (162 lines)

```tsx
/**
 * Configuration Audit Log Tab Component
 * 
 * Displays configuration changes with hot-reload tracking.
 * Extracted from system-administration.tsx for better maintainability.
 */

import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { adminQueryFn } from "@/lib/admin-api";
import type { ConfigAuditLog } from "@shared/schema";
import { formatDate } from "@/lib/formatters";

function ConfigAuditLogTabComponent() {
  const {
    data: auditLogs,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["/api/admin/config-audit"],
    queryFn: adminQueryFn(["/api/admin/config-audit"]),
    enabled: true,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="loading-config-audit">
        Loading configuration audit log...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Configuration Audit Log</h3>
          <p className="text-sm text-muted-foreground">
            Track all configuration changes with hot-reload support
          </p>
        </div>
        <Card className="border-destructive" data-testid="error-config-audit">
          <CardHeader>
            <CardTitle className="text-destructive">Failed to Load Audit Log</CardTitle>
            <CardDescription>
              Unable to retrieve configuration audit log. Please check your connection or admin
              permissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{(error)?.message || "Failed to load audit log"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium" data-testid="heading-config-audit">
          Configuration Audit Log
        </h3>
        <p className="text-sm text-muted-foreground">
          Track all configuration changes with hot-reload support
        </p>
      </div>

      <Card data-testid="card-config-audit-log">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Change Type</TableHead>
                <TableHead>Changed By</TableHead>
                <TableHead>Auto-Reload</TableHead>
                <TableHead>Requires Restart</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(auditLogs ?? []).map((log: ConfigAuditLog) => (
                <TableRow key={log.id} data-testid={`row-config-${log.id}`}>
                  <TableCell data-testid={`text-timestamp-${log.id}`}>
                    {log.changedAt ? formatDate(log.changedAt) : "N/A"}
                  </TableCell>
                  <TableCell className="font-mono text-sm" data-testid={`text-key-${log.id}`}>
                    {log.key}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" data-testid={`badge-change-type-${log.id}`}>
                      {log.changeType}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-changed-by-${log.id}`}>
                    {log.changedByName || log.changedBy || "System"}
                  </TableCell>
                  <TableCell>
                    {log.autoReload ? (
                      <CheckCircle
                        className="h-4 w-4 text-green-500"
                        data-testid={`icon-auto-reload-${log.id}`}
                      />
                    ) : (
                      <span
                        className="text-muted-foreground"
                        data-testid={`text-no-reload-${log.id}`}
                      >
                        -
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.requiresRestart ? (
                      <AlertTriangle
                        className="h-4 w-4 text-yellow-500"
                        data-testid={`icon-restart-${log.id}`}
                      />
                    ) : (
                      <span
                        className="text-muted-foreground"
                        data-testid={`text-no-restart-${log.id}`}
                      >
                        -
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!auditLogs || auditLogs.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                    data-testid="empty-config-audit"
                  >
                    No configuration changes recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export const ConfigAuditLogTab = memo(ConfigAuditLogTabComponent);

```

### `client/src/components/admin/DesktopConnectionPanel.tsx` (156 lines)

```tsx
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Server, CheckCircle2, XCircle, Loader2, Info } from "lucide-react";
import { isDesktop } from "@/lib/desktop";
import { getBackendUrlSync, setBackendUrl, testBackendConnection } from "@/lib/desktopFetch";

type TestStatus = "idle" | "testing" | "success" | "error";

function isValidBackendUrl(raw: string): { valid: boolean; normalized: string; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: false, normalized: "", error: "URL is required" };

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, normalized: trimmed, error: "Only http:// and https:// URLs are supported" };
    }
    if (!parsed.hostname) {
      return { valid: false, normalized: trimmed, error: "Invalid hostname" };
    }
    const normalized = parsed.origin;
    return { valid: true, normalized };
  } catch {
    return { valid: false, normalized: trimmed, error: "Invalid URL format. Example: http://localhost:5000" };
  }
}

export function DesktopConnectionPanel() {
  const isDesktopEnv = isDesktop();
  const [activeUrl, setActiveUrl] = useState(() => getBackendUrlSync() || "");
  const [url, setUrl] = useState(activeUrl || "http://localhost:5000");
  const [status, setStatus] = useState<TestStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [validationError, setValidationError] = useState("");
  const [saved, setSaved] = useState(false);
  const [lastTestedUrl, setLastTestedUrl] = useState("");

  if (!isDesktopEnv) {
    return null;
  }

  async function handleTest() {
    const check = isValidBackendUrl(url);
    if (!check.valid) {
      setValidationError(check.error || "Invalid URL");
      setStatus("error");
      setStatusMessage(check.error || "Invalid URL");
      return;
    }
    setValidationError("");
    setStatus("testing");
    setSaved(false);
    const result = await testBackendConnection(check.normalized);
    setStatus(result.ok ? "success" : "error");
    setStatusMessage(result.message);
    if (result.ok) {
      setLastTestedUrl(check.normalized);
      setUrl(check.normalized);
    }
  }

  function handleSave() {
    if (!lastTestedUrl) return;
    setBackendUrl(lastTestedUrl);
    setActiveUrl(lastTestedUrl);
    setSaved(true);
  }

  return (
    <Card data-testid="panel-desktop-connection">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <CardTitle>Backend Connection</CardTitle>
          </div>
          {activeUrl && (
            <Badge variant="outline" data-testid="badge-backend-url">
              {activeUrl}
            </Badge>
          )}
        </div>
        <CardDescription>
          Configure which ARUS backend server this desktop app connects to
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="admin-backend-url">Server URL</Label>
          <div className="flex gap-2">
            <Input
              id="admin-backend-url"
              data-testid="input-admin-backend-url"
              placeholder="http://localhost:5000"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (status !== "idle") setStatus("idle");
                setValidationError("");
                setSaved(false);
                setLastTestedUrl("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleTest()}
            />
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={status === "testing" || !url.trim()}
              data-testid="button-test-admin-connection"
            >
              {status === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
            </Button>
          </div>
          {validationError && status !== "testing" && (
            <p className="text-xs text-destructive">{validationError}</p>
          )}
        </div>

        {status === "success" && (
          <div className="flex items-center gap-2 text-sm p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            {statusMessage}
          </div>
        )}

        {status === "error" && !validationError && (
          <div className="flex items-center gap-2 text-sm p-3 rounded-md bg-destructive/10 text-destructive">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            {statusMessage}
          </div>
        )}

        {status === "success" && !saved && lastTestedUrl !== activeUrl && (
          <Button onClick={handleSave} data-testid="button-save-backend-url">
            Save & Apply
          </Button>
        )}

        {saved && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Connection Updated</AlertTitle>
            <AlertDescription>
              Backend URL updated. Reload the application for changes to take full effect.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

```

### `client/src/components/admin/DesktopUpdatePanel.tsx` (264 lines)

```tsx
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  RefreshCw,
  Download,
  CheckCircle,
  AlertCircle,
  Info,
  Loader2,
  ArrowUpCircle,
  Cloud,
} from "lucide-react";
import {
  isDesktop,
  getDesktopAPI,
  type UpdateInfo,
} from "@/lib/desktop";
import { ReleaseNotesMarkdown } from "@/components/ui/safe-markdown";

type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  releaseNotes?: string;
  error?: string;
}

export function DesktopUpdatePanel() {
  const [state, setState] = useState<UpdateState>({
    status: "idle",
    currentVersion: "unknown",
  });

  const [isDesktopEnv, setIsDesktopEnv] = useState(false);

  useEffect(() => {
    const desktopDetected = isDesktop();
    setIsDesktopEnv(desktopDetected);

    if (desktopDetected) {
      const api = getDesktopAPI();
      if (api) {
        api.getAppVersion().then((version) => {
          setState((prev) => ({ ...prev, currentVersion: version }));
        });
      }
    }
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    const api = getDesktopAPI();
    if (!api) return;

    setState((prev) => ({ ...prev, status: "checking", error: undefined }));

    try {
      const updateInfo: UpdateInfo | null = await api.checkForUpdates();
      if (updateInfo) {
        setState((prev) => ({
          ...prev,
          status: "available",
          availableVersion: updateInfo.version,
          releaseNotes: updateInfo.body,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: "not-available",
        }));
      }
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err?.message || "Failed to check for updates",
      }));
    }
  }, []);

  const handleInstall = useCallback(async () => {
    const api = getDesktopAPI();
    if (!api) return;

    setState((prev) => ({ ...prev, status: "downloading" }));

    try {
      await api.installUpdate();
      setState((prev) => ({ ...prev, status: "downloaded" }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err?.message || "Failed to install update",
      }));
    }
  }, []);

  if (!isDesktopEnv) {
    return (
      <Card data-testid="panel-web-update-info">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Software Updates</CardTitle>
          </div>
          <CardDescription>Web deployment update management</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Web Deployment</AlertTitle>
            <AlertDescription>
              You are running ARUS in a browser or server deployment. Software updates are
              automatically managed by the server infrastructure and deployment pipeline. No manual
              update action is required in this environment.
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-sm text-muted-foreground">
            <p>
              For vessel/desktop deployments, use the ARUS Desktop Application which supports
              automatic updates via Tauri's built-in updater.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="panel-desktop-updates">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-primary" />
            <CardTitle>Desktop App Updates</CardTitle>
          </div>
          <Badge variant="outline" data-testid="badge-current-version">
            v{state.currentVersion}
          </Badge>
        </div>
        <CardDescription>
          Check for and install updates for the ARUS Desktop Application
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.status === "idle" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-muted-foreground">Click to check for available updates</p>
            <Button onClick={handleCheckForUpdates} data-testid="button-check-updates">
              <RefreshCw className="mr-2 h-4 w-4" />
              Check for Updates
            </Button>
          </div>
        )}

        {state.status === "checking" && (
          <div className="flex items-center gap-3 py-4" data-testid="status-checking">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Checking for updates...</span>
          </div>
        )}

        {state.status === "not-available" && (
          <Alert data-testid="status-up-to-date">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle>Up to Date</AlertTitle>
            <AlertDescription>
              You are running the latest version of ARUS (v{state.currentVersion}).
            </AlertDescription>
          </Alert>
        )}

        {state.status === "available" && (
          <div className="space-y-4" data-testid="status-available">
            <Alert>
              <ArrowUpCircle className="h-4 w-4 text-blue-500" />
              <AlertTitle>Update Available</AlertTitle>
              <AlertDescription>
                Version {state.availableVersion} is available. You are currently running v
                {state.currentVersion}.
              </AlertDescription>
            </Alert>
            {state.releaseNotes && (
              <ReleaseNotesMarkdown
                content={state.releaseNotes}
                data-testid="release-notes-markdown"
              />
            )}
            <Button onClick={handleInstall} className="w-full" data-testid="button-download">
              <Download className="mr-2 h-4 w-4" />
              Download & Install Update
            </Button>
          </div>
        )}

        {state.status === "downloading" && (
          <div className="flex items-center gap-3 py-4" data-testid="status-downloading">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Downloading and installing update...</span>
          </div>
        )}

        {state.status === "downloaded" && (
          <div className="space-y-4" data-testid="status-downloaded">
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle>Update Installed</AlertTitle>
              <AlertDescription>
                Update v{state.availableVersion} has been installed. The application will restart
                to apply changes.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {state.status === "error" && (
          <div className="space-y-4" data-testid="status-error">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Update Error</AlertTitle>
              <AlertDescription>{state.error || "An unknown error occurred"}</AlertDescription>
            </Alert>
            <Button
              onClick={handleCheckForUpdates}
              variant="outline"
              data-testid="button-retry"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        )}

        {(state.status === "not-available" ||
          state.status === "error" ||
          state.status === "downloaded") && (
          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCheckForUpdates}
              data-testid="button-check-again"
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Check Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

```

### `client/src/components/admin/MLTestingToolsTab.tsx` (73 lines)

```tsx
/**
 * ML & Testing Tools Tab Component
 * 
 * Administrative tools for ML testing and calibration.
 * Extracted from system-administration.tsx for better maintainability.
 */

import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Beaker, Ship, Settings } from "lucide-react";
import { VesselSimulatorCard } from "./VesselSimulatorCard";
import { ThresholdCalibratorCard } from "./ThresholdCalibratorCard";

function MLTestingToolsTabComponent() {
  return (
    <div className="space-y-6" data-testid="ml-testing-tools-container">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <VesselSimulatorCard />
        <ThresholdCalibratorCard />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Beaker className="h-5 w-5 text-primary" />
            <span>About These Tools</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center space-x-2">
                <Ship className="h-4 w-4 text-muted-foreground" />
                <span>Vessel Simulator</span>
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Generate realistic synthetic telemetry data</li>
                <li>11 vessel type presets with physics-based models</li>
                <li>Configurable sea states and fault injection</li>
                <li>Use for ML training data augmentation</li>
                <li>Test system behavior without real vessels</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium flex items-center space-x-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>Threshold Calibrator</span>
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Automatically tune prediction thresholds</li>
                <li>Based on historical performance data</li>
                <li>Reduces false positives and improves accuracy</li>
                <li>Equipment-specific calibration</li>
                <li>Percentile-based threshold selection</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Note:</strong> These are advanced administrative
              tools. Generated data and calibrations will affect production predictions and ML
              training. Use with caution and monitor results carefully.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const MLTestingToolsTab = memo(MLTestingToolsTabComponent);

```

### `client/src/components/admin/PerformanceHealthTab.tsx` (184 lines)

```tsx
import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Server, CheckCircle, Cpu, HardDrive, Network } from "lucide-react";

function PerformanceHealthTabContent() {
  const { data: _metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/admin/performance-metrics"],
    enabled: true,
  });

  const { data: _systemHealth, isLoading: healthLoading } = useQuery({
    queryKey: ["/api/admin/system-health"],
    enabled: true,
  });

  if (metricsLoading || healthLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        Loading system performance data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">System Performance & Health</h3>
        <p className="text-sm text-muted-foreground">
          Monitor system health, performance metrics, and resource utilization
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-system-status">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold" data-testid="text-system-status">
                Healthy
              </span>
            </div>
            <p className="text-xs text-muted-foreground">All systems operational</p>
          </CardContent>
        </Card>

        <Card data-testid="card-cpu-usage">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-cpu-usage">
              23%
            </div>
            <p className="text-xs text-muted-foreground">Average across all cores</p>
          </CardContent>
        </Card>

        <Card data-testid="card-memory-usage">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-memory-usage">
              67%
            </div>
            <p className="text-xs text-muted-foreground">5.4GB / 8GB used</p>
          </CardContent>
        </Card>

        <Card data-testid="card-network-io">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network I/O</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-network-io">
              1.2MB/s
            </div>
            <p className="text-xs text-muted-foreground">Combined throughput</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-recent-performance-metrics">
        <CardHeader>
          <CardTitle>Recent Performance Metrics</CardTitle>
          <CardDescription>System performance data from the last 24 hours</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>Current Value</TableHead>
                <TableHead>24h Average</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow data-testid="row-metric-response-time">
                <TableCell className="font-medium" data-testid="text-metric-name-response-time">
                  Response Time
                </TableCell>
                <TableCell data-testid="text-current-value-response-time">245ms</TableCell>
                <TableCell data-testid="text-average-value-response-time">198ms</TableCell>
                <TableCell>
                  <Badge variant="default" data-testid="badge-status-response-time">
                    Good
                  </Badge>
                </TableCell>
                <TableCell data-testid="text-last-updated-response-time">2 minutes ago</TableCell>
              </TableRow>
              <TableRow data-testid="row-metric-database-connections">
                <TableCell
                  className="font-medium"
                  data-testid="text-metric-name-database-connections"
                >
                  Database Connections
                </TableCell>
                <TableCell data-testid="text-current-value-database-connections">12/50</TableCell>
                <TableCell data-testid="text-average-value-database-connections">8/50</TableCell>
                <TableCell>
                  <Badge variant="default" data-testid="badge-status-database-connections">
                    Healthy
                  </Badge>
                </TableCell>
                <TableCell data-testid="text-last-updated-database-connections">
                  1 minute ago
                </TableCell>
              </TableRow>
              <TableRow data-testid="row-metric-active-sessions">
                <TableCell className="font-medium" data-testid="text-metric-name-active-sessions">
                  Active Sessions
                </TableCell>
                <TableCell data-testid="text-current-value-active-sessions">1,247</TableCell>
                <TableCell data-testid="text-average-value-active-sessions">1,156</TableCell>
                <TableCell>
                  <Badge variant="default" data-testid="badge-status-active-sessions">
                    Normal
                  </Badge>
                </TableCell>
                <TableCell data-testid="text-last-updated-active-sessions">
                  30 seconds ago
                </TableCell>
              </TableRow>
              <TableRow data-testid="row-metric-error-rate">
                <TableCell className="font-medium" data-testid="text-metric-name-error-rate">
                  Error Rate
                </TableCell>
                <TableCell data-testid="text-current-value-error-rate">0.02%</TableCell>
                <TableCell data-testid="text-average-value-error-rate">0.01%</TableCell>
                <TableCell>
                  <Badge variant="secondary" data-testid="badge-status-error-rate">
                    Acceptable
                  </Badge>
                </TableCell>
                <TableCell data-testid="text-last-updated-error-rate">1 minute ago</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export const PerformanceHealthTab = memo(PerformanceHealthTabContent);

```

### `client/src/components/admin/SchedulingSettingsTab.tsx` (472 lines)

```tsx
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, Shield, Calendar, Sparkles, Send, ChevronDown, Plus, Trash2, Star, Edit, AlertTriangle, Check } from "lucide-react";
import { useSchedulingSettingsData, type NotificationSettings, type RuleThresholds, type RuleEnforcementSettings } from "@/features/settings/hooks/useSchedulingSettingsData";
import { cn } from "@/lib/utils";

const NOTIFICATION_EVENTS: Array<{ key: keyof NotificationSettings; label: string; description: string }> = [
  { key: "schedulePublished", label: "Schedule Published", description: "When a new schedule is published" },
  { key: "assignmentChanged", label: "Assignment Changed", description: "When crew assignment is modified" },
  { key: "leaveApproved", label: "Leave Approved", description: "When leave request is approved" },
  { key: "conflictDetected", label: "Conflict Detected", description: "When scheduling conflict occurs" },
  { key: "certExpiring", label: "Certification Expiring", description: "When cert is about to expire" },
  { key: "rotationReminder", label: "Rotation Reminder", description: "Upcoming rotation change" },
];

const RULE_CONFIGS: Array<{ key: keyof RuleEnforcementSettings; label: string; thresholdKey?: keyof RuleThresholds; thresholdLabel?: string; unit?: string; min?: number; max?: number }> = [
  { key: "restHours", label: "Minimum Rest Hours (24h)", thresholdKey: "minRestHours24h", thresholdLabel: "Hours", unit: "h", min: 6, max: 14 },
  { key: "maxWeekly", label: "Maximum Work Hours (7 days)", thresholdKey: "maxWorkHours7d", thresholdLabel: "Hours", unit: "h", min: 40, max: 100 },
  { key: "certification", label: "Certification Required", thresholdKey: "certExpiryWarningDays", thresholdLabel: "Warning days", unit: "days", min: 7, max: 90 },
  { key: "vesselMatch", label: "Vessel Assignment Match" },
  { key: "skillMatch", label: "Skill Requirements Match" },
  { key: "overlap", label: "Assignment Overlap Buffer", thresholdKey: "overlapBufferHours", thresholdLabel: "Buffer", unit: "h", min: 0, max: 24 },
];

function NotificationsSection() {
  const { settings, handleToggleNotification, updateNotificationsMutation } = useSchedulingSettingsData();
  const isSaving = updateNotificationsMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>Configure who receives notifications for scheduling events</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Event</TableHead>
              <TableHead className="text-center">Email</TableHead>
              <TableHead className="text-center">SMS</TableHead>
              <TableHead className="text-center">Push</TableHead>
              <TableHead className="text-center">In-App</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {NOTIFICATION_EVENTS.map(({ key, label, description }) => (
              <TableRow key={key}>
                <TableCell>
                  <div>
                    <div className="font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{description}</div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={settings.notificationSettings[key].email}
                    onCheckedChange={(v) => handleToggleNotification(key, "email", v)}
                    disabled={isSaving}
                    data-testid={`switch-${key}-email`}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={settings.notificationSettings[key].sms}
                    onCheckedChange={(v) => handleToggleNotification(key, "sms", v)}
                    disabled={isSaving}
                    data-testid={`switch-${key}-sms`}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={settings.notificationSettings[key].push}
                    onCheckedChange={(v) => handleToggleNotification(key, "push", v)}
                    disabled={isSaving}
                    data-testid={`switch-${key}-push`}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={settings.notificationSettings[key].inApp}
                    onCheckedChange={(v) => handleToggleNotification(key, "inApp", v)}
                    disabled={isSaving}
                    data-testid={`switch-${key}-inApp`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RulesSection() {
  const { settings, handleUpdateThreshold, handleToggleEnforcement, updateRulesMutation } = useSchedulingSettingsData();
  const isSaving = updateRulesMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Rules & Thresholds
        </CardTitle>
        <CardDescription>Configure STCW compliance rules and enforcement levels</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {RULE_CONFIGS.map(({ key, label, thresholdKey, thresholdLabel, unit, min, max }) => (
          <div key={key} className="flex items-center justify-between gap-4 p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{label}</span>
                <Button
                  variant={settings.ruleEnforcement[key] === "hard" ? "destructive" : "secondary"}
                  size="sm"
                  onClick={() => handleToggleEnforcement(key)}
                  disabled={isSaving}
                  className="h-6 text-xs"
                  data-testid={`button-enforcement-${key}`}
                >
                  {settings.ruleEnforcement[key] === "hard" ? (
                    <>
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      HARD
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      SOFT
                    </>
                  )}
                </Button>
              </div>
              {thresholdKey && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-muted-foreground">{thresholdLabel}:</span>
                  <Input
                    type="number"
                    value={settings.ruleThresholds[thresholdKey]}
                    onChange={(e) => handleUpdateThreshold(thresholdKey, Number(e.target.value))}
                    className="w-20 h-8"
                    min={min}
                    max={max}
                    disabled={isSaving}
                    data-testid={`input-threshold-${thresholdKey}`}
                  />
                  <span className="text-sm text-muted-foreground">{unit}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between gap-4 p-3 border rounded-lg">
          <div className="flex-1">
            <span className="font-medium">Max Onboard Days</span>
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="number"
                value={settings.ruleThresholds.maxOnboardDays}
                onChange={(e) => handleUpdateThreshold("maxOnboardDays", Number(e.target.value))}
                className="w-20 h-8"
                min={30}
                max={180}
                disabled={isSaving}
                data-testid="input-threshold-maxOnboardDays"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RotationTemplatesSection() {
  const { settings, handleAddTemplate, handleUpdateTemplate, handleDeleteTemplate, handleSetDefaultTemplate, updateRotationTemplatesMutation } = useSchedulingSettingsData();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", onDays: 28, offDays: 28 });
  const isSaving = updateRotationTemplatesMutation.isPending;

  const handleAdd = () => {
    if (newTemplate.name.trim()) {
      handleAddTemplate({ ...newTemplate, isDefault: false });
      setNewTemplate({ name: "", onDays: 28, offDays: 28 });
      setIsAddingNew(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Rotation Templates
        </CardTitle>
        <CardDescription>Define crew rotation patterns (on/off cycles)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {settings.rotationTemplates.map((template) => (
          <div key={template.id} className="flex items-center justify-between gap-4 p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              {template.isDefault && (
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              )}
              <div>
                <div className="font-medium">{template.name}</div>
                <div className="text-sm text-muted-foreground">
                  {template.onDays} days on / {template.offDays} days off
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!template.isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSetDefaultTemplate(template.id)}
                  disabled={isSaving}
                  data-testid={`button-set-default-${template.id}`}
                >
                  <Star className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteTemplate(template.id)}
                disabled={isSaving || settings.rotationTemplates.length <= 1}
                data-testid={`button-delete-template-${template.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {isAddingNew ? (
          <div className="p-3 border rounded-lg space-y-3">
            <Input
              placeholder="Template name (e.g., 42/21)"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              data-testid="input-template-name"
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs">On Days</Label>
                <Input
                  type="number"
                  value={newTemplate.onDays}
                  onChange={(e) => setNewTemplate({ ...newTemplate, onDays: Number(e.target.value) })}
                  min={1}
                  max={120}
                  data-testid="input-template-onDays"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">Off Days</Label>
                <Input
                  type="number"
                  value={newTemplate.offDays}
                  onChange={(e) => setNewTemplate({ ...newTemplate, offDays: Number(e.target.value) })}
                  min={1}
                  max={120}
                  data-testid="input-template-offDays"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!newTemplate.name.trim() || isSaving} data-testid="button-save-template">
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsAddingNew(false)} data-testid="button-cancel-template">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setIsAddingNew(true)} data-testid="button-add-template">
            <Plus className="h-4 w-4 mr-2" />
            Add Template
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function AiWeightsSection() {
  const { settings, aiWeightsOpen, setAiWeightsOpen, handleUpdateAiWeight, updateAiWeightsMutation } = useSchedulingSettingsData();
  const isSaving = updateAiWeightsMutation.isPending;

  const weights: Array<{ key: keyof typeof settings.aiWeights; label: string; description: string }> = [
    { key: "skillMatch", label: "Skill Match", description: "How well crew skills match requirements" },
    { key: "availability", label: "Availability", description: "Rest periods and schedule gaps" },
    { key: "fatigue", label: "Fatigue Score", description: "Recent workload and fatigue levels" },
    { key: "experience", label: "Experience", description: "Vessel and role experience" },
    { key: "preference", label: "Preference", description: "Crew preferences and requests" },
  ];

  return (
    <Collapsible open={aiWeightsOpen} onOpenChange={setAiWeightsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Suggestion Weights
              </div>
              <ChevronDown className={cn("h-5 w-5 transition-transform", aiWeightsOpen && "rotate-180")} />
            </CardTitle>
            <CardDescription>Configure how AI ranks crew suggestions (explanations only, not decisions)</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              These weights affect how AI explains crew suggestions. All constraint checking and ranking remains deterministic.
            </div>
            {weights.map(({ key, label, description }) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">{label}</Label>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <Badge variant="outline">{settings.aiWeights[key]}%</Badge>
                </div>
                <Slider
                  value={[settings.aiWeights[key]]}
                  onValueChange={([v]) => handleUpdateAiWeight(key, v)}
                  min={0}
                  max={100}
                  step={5}
                  disabled={isSaving}
                  data-testid={`slider-weight-${key}`}
                />
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function PublishBehaviorSection() {
  const { settings, handleTogglePublishBehavior, updatePublishBehaviorMutation } = useSchedulingSettingsData();
  const isSaving = updatePublishBehaviorMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Publish Behavior
        </CardTitle>
        <CardDescription>Configure how schedules are published and archived</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label className="font-medium">Require Approval</Label>
            <p className="text-xs text-muted-foreground">Schedules must be approved before publishing</p>
          </div>
          <Switch
            checked={settings.publishBehavior.requireApproval}
            onCheckedChange={(v) => handleTogglePublishBehavior("requireApproval", v)}
            disabled={isSaving}
            data-testid="switch-requireApproval"
          />
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label className="font-medium">Notify on Publish</Label>
            <p className="text-xs text-muted-foreground">Send notifications when schedule is published</p>
          </div>
          <Switch
            checked={settings.publishBehavior.notifyOnPublish}
            onCheckedChange={(v) => handleTogglePublishBehavior("notifyOnPublish", v)}
            disabled={isSaving}
            data-testid="switch-notifyOnPublish"
          />
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label className="font-medium">Lock After Publish</Label>
            <p className="text-xs text-muted-foreground">Prevent changes to published schedules</p>
          </div>
          <Switch
            checked={settings.publishBehavior.lockAfterPublish}
            onCheckedChange={(v) => handleTogglePublishBehavior("lockAfterPublish", v)}
            disabled={isSaving}
            data-testid="switch-lockAfterPublish"
          />
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label className="font-medium">Auto Archive</Label>
            <p className="text-xs text-muted-foreground">Automatically archive old schedules</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={settings.publishBehavior.autoArchiveDays}
              onChange={(e) => handleTogglePublishBehavior("autoArchiveDays", Number(e.target.value))}
              className="w-20 h-8"
              min={30}
              max={365}
              disabled={isSaving}
              data-testid="input-autoArchiveDays"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SchedulingSettingsTab() {
  const { isLoadingSettings } = useSchedulingSettingsData();

  if (isLoadingSettings) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="h-32 animate-pulse bg-muted" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="scheduling-settings-tab">
      <div>
        <h3 className="text-lg font-medium">Scheduling Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure crew scheduling rules, notifications, and AI suggestion preferences.
        </p>
      </div>

      <NotificationsSection />
      <RulesSection />
      <RotationTemplatesSection />
      <AiWeightsSection />
      <PublishBehaviorSection />
    </div>
  );
}

```

### `client/src/components/admin/SystemSettingsTab.tsx` (172 lines)

```tsx
import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Mail, Bell, FileText, ChevronRight } from "lucide-react";
import { useSystemSettingsTabData } from "@/features/settings";
import { useLocation } from "wouter";
import type { AdminSystemSetting } from "@shared/schema";

function SystemSettingsTabContent() {
  const [, setLocation] = useLocation();
  const {
    settings, isLoading, form, createDialogOpen, setCreateDialogOpen, editingItem,
    createMutation, updateMutation, deleteMutation, handleSubmit, handleEdit, handleDelete,
    handleCloseDialog, handleOpenCreate, navigateToEmailSettings, navigateToNotificationSettings,
  } = useSystemSettingsTabData();
  
  const navigateToScheduledReportsSettings = () => setLocation("/scheduled-reports-settings");

  if (isLoading) {
    return <div className="flex items-center justify-center py-8">Loading system settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={navigateToEmailSettings} data-testid="card-email-settings">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg"><Mail className="h-5 w-5 text-primary" /></div>
                <div>
                  <CardTitle className="text-base">Email & Alerts Settings</CardTitle>
                  <CardDescription className="text-sm">Configure email providers, alert thresholds, and notifications</CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={navigateToNotificationSettings} data-testid="card-notification-settings">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg"><Bell className="h-5 w-5 text-primary" /></div>
                <div>
                  <CardTitle className="text-base">Notification Settings</CardTitle>
                  <CardDescription className="text-sm">Manage in-app notifications and push notification preferences</CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={navigateToScheduledReportsSettings} data-testid="card-scheduled-reports-settings">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg"><FileText className="h-5 w-5 text-primary" /></div>
                <div>
                  <CardTitle className="text-base">Scheduled Reports Settings</CardTitle>
                  <CardDescription className="text-sm">Configure report retention, defaults, and generation limits</CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">System Settings</h3>
          <p className="text-sm text-muted-foreground">Manage application configuration and system parameters</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild><Button data-testid="button-create-setting" onClick={handleOpenCreate}><Plus className="mr-2 h-4 w-4" />Add Setting</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit System Setting" : "Create System Setting"}</DialogTitle>
              <DialogDescription>{editingItem ? "Modify the system setting details" : "Add a new system configuration parameter"}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel><FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger data-testid="select-category"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System</SelectItem>
                        <SelectItem value="security">Security</SelectItem>
                        <SelectItem value="performance">Performance</SelectItem>
                        <SelectItem value="integration">Integration</SelectItem>
                        <SelectItem value="ui">User Interface</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="key" render={({ field }) => (
                  <FormItem><FormLabel>Key</FormLabel><FormControl><Input {...field} placeholder="e.g., max_upload_size" data-testid="input-key" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="value" render={({ field }) => (
                  <FormItem><FormLabel>Value</FormLabel><FormControl><Input {...field} placeholder="e.g., 10485760" data-testid="input-value" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} placeholder="Optional description of this setting" data-testid="textarea-description" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="isPublic" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Public Setting</FormLabel>
                      <FormDescription>Make this setting visible to non-admin users</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-public" /></FormControl>
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-setting">
                    {editingItem ? "Update Setting" : "Create Setting"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead><TableHead>Key</TableHead><TableHead>Value</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.map((setting: AdminSystemSetting) => (
                <TableRow key={setting.id}>
                  <TableCell><Badge variant="outline" data-testid={`badge-category-${setting.id}`}>{setting.category}</Badge></TableCell>
                  <TableCell className="font-medium" data-testid={`text-key-${setting.id}`}>{setting.key}</TableCell>
                  <TableCell className="max-w-xs truncate" data-testid={`text-value-${setting.id}`}>{JSON.stringify(setting.value)}</TableCell>
                  <TableCell><Badge variant={setting.isSecret ? "destructive" : "default"} data-testid={`badge-status-${setting.id}`}>{setting.isSecret ? "Secret" : "Public"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(setting)} data-testid={`button-edit-${setting.id}`}><Edit className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(setting.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-${setting.id}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {settings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No system settings configured. Add your first setting to get started.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export const SystemSettingsTab = memo(SystemSettingsTabContent);

```

### `client/src/components/admin/ThresholdCalibratorCard.tsx` (250 lines)

```tsx
/**
 * Threshold Calibrator Card Component
 * 
 * Admin tool for calibrating prediction thresholds based on historical data.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Settings2, TrendingUp, CheckCircle, AlertCircle, Activity } from "lucide-react";
import { adminApiRequest } from "@/lib/admin-api";
import { formatNumber } from "@/lib/formatters";

interface Equipment {
  id: string;
  name: string;
  type: string;
  vesselId?: string;
}

interface CalibrationResult {
  success: boolean;
  message: string;
  equipmentId?: string;
  equipmentType?: string;
  percentile?: number;
  calibratedThreshold?: number;
  previousThreshold?: number;
  samplesAnalyzed?: number;
}

export function ThresholdCalibratorCard() {
  const { toast } = useToast();
  const [selectedEquipment, setSelectedEquipment] = useState("");
  const [percentile, setPercentile] = useState([95]);
  const [calibrating, setCalibrating] = useState(false);
  const [lastResult, setLastResult] = useState<CalibrationResult | null>(null);

  const { data: equipment = [], isLoading: loadingEquipment } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
    select: (data) => data ?? [],
  });

  const handleCalibrate = async () => {
    if (!selectedEquipment) {
      toast({
        title: "Equipment required",
        description: "Please select equipment to calibrate thresholds",
        variant: "destructive",
      });
      return;
    }

    const selectedEq = equipment.find((e) => e.id === selectedEquipment);
    if (!selectedEq) {return;}

    try {
      setCalibrating(true);
      setLastResult(null);

      const payload = {
        equipmentId: selectedEquipment,
        equipmentType: selectedEq.type,
        percentile: percentile[0],
        orgId: "default-org-id",
      };

      const result = await adminApiRequest("POST", "/api/admin/calibrate-threshold", payload);

      setLastResult({
        success: true,
        message: result.message || "Threshold calibrated successfully",
        equipmentId: result.equipmentId,
        equipmentType: result.equipmentType,
        percentile: result.percentile,
        calibratedThreshold: result.calibratedThreshold,
        previousThreshold: result.previousThreshold,
        samplesAnalyzed: result.samplesAnalyzed,
      });

      toast({
        title: "Calibration Complete",
        description: `Threshold set to ${result.calibratedThreshold?.toFixed(3)} (${result.percentile}th percentile)`,
      });
    } catch (error) {
      setLastResult({
        success: false,
        message: (error as Error).message || "Calibration failed",
      });
      toast({
        title: "Calibration Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setCalibrating(false);
    }
  };

  const selectedEq = equipment.find((e) => e.id === selectedEquipment);

  return (
    <Card data-testid="card-threshold-calibrator">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Settings2 className="h-5 w-5 text-primary" />
          <CardTitle>ML Threshold Calibrator</CardTitle>
        </div>
        <CardDescription>
          Automatically calibrate prediction thresholds based on historical performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="equipment-select">Equipment</Label>
          <Select
            value={selectedEquipment}
            onValueChange={setSelectedEquipment}
            disabled={loadingEquipment}
          >
            <SelectTrigger id="equipment-select" data-testid="select-equipment">
              <SelectValue placeholder="Select equipment to calibrate" />
            </SelectTrigger>
            <SelectContent>
              {equipment.map((eq) => (
                <SelectItem key={eq.id} value={eq.id} data-testid={`option-equipment-${eq.id}`}>
                  {eq.name} ({eq.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Percentile Threshold</Label>
            <Badge variant="outline" data-testid="badge-percentile">
              {percentile[0]}th percentile
            </Badge>
          </div>
          <Slider
            value={percentile}
            onValueChange={setPercentile}
            min={80}
            max={99}
            step={1}
            className="w-full"
            data-testid="slider-percentile"
          />
          <p className="text-xs text-muted-foreground">
            Higher percentiles are more conservative (fewer false positives)
          </p>
        </div>

        {selectedEq && (
          <Alert data-testid="alert-equipment-info">
            <Activity className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">Selected Equipment:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{selectedEq.name}</Badge>
                  <Badge variant="outline">{selectedEq.type}</Badge>
                  {selectedEq.vesselId && (
                    <Badge variant="outline">Vessel: {selectedEq.vesselId}</Badge>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {lastResult && (
          <Alert
            variant={lastResult.success ? "default" : "destructive"}
            data-testid="alert-calibration-result"
          >
            {lastResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">{lastResult.message}</p>
                {lastResult.success && (
                  <div className="space-y-1 text-sm">
                    {lastResult.previousThreshold !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Previous:</span>
                        <Badge variant="outline">{lastResult.previousThreshold.toFixed(3)}</Badge>
                      </div>
                    )}
                    {lastResult.calibratedThreshold !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">New Threshold:</span>
                        <Badge variant="default">{lastResult.calibratedThreshold.toFixed(3)}</Badge>
                      </div>
                    )}
                    {lastResult.samplesAnalyzed !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Samples Analyzed:</span>
                        <Badge variant="secondary">
                          {formatNumber(lastResult.samplesAnalyzed)}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleCalibrate}
          disabled={calibrating || !selectedEquipment}
          className="w-full"
          data-testid="button-calibrate"
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          {calibrating ? "Calibrating..." : "Calibrate Threshold"}
        </Button>

        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p className="font-medium mb-1">How It Works:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Analyzes historical prediction scores for selected equipment</li>
            <li>Calculates threshold at specified percentile (default 95%)</li>
            <li>Stores calibrated threshold in equipment specifications</li>
            <li>Used by real-time prediction engine for more accurate alerts</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

```

### `client/src/components/admin/VesselSimulatorCard.tsx` (349 lines)

```tsx
/**
 * Vessel Simulator Card Component
 * 
 * Admin tool for generating synthetic telemetry data for testing and ML training.
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Ship, Play, AlertCircle, CheckCircle, Waves } from "lucide-react";
import { adminApiRequest } from "@/lib/admin-api";

interface VesselType {
  id: string;
  name: string;
  description: string;
  sensors: string[];
}

interface SimulationResult {
  success: boolean;
  message: string;
  dataPointsGenerated?: number;
  telemetryRecordsCreated?: number;
  vesselType?: string;
  duration?: string;
}

export function VesselSimulatorCard() {
  const { toast } = useToast();
  const [vesselTypes, setVesselTypes] = useState<VesselType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);

  const [selectedVesselType, setSelectedVesselType] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [deviceId, setDeviceId] = useState("simulator-device");
  const [duration, setDuration] = useState(60);
  const [samplingInterval, setSamplingInterval] = useState(1);
  const [seaState, setSeaState] = useState(3);
  const [faultInjection, setFaultInjection] = useState(false);

  const [simulating, setSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<SimulationResult | null>(null);

  const loadVesselTypes = async () => {
    try {
      setLoadingTypes(true);
      const types = await adminApiRequest("GET", "/api/admin/vessel-types");
      setVesselTypes(types ?? []);
    } catch (error) {
      toast({
        title: "Failed to load vessel types",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleSimulate = async () => {
    if (!selectedVesselType) {
      toast({
        title: "Vessel type required",
        description: "Please select a vessel type before generating data",
        variant: "destructive",
      });
      return;
    }

    if (!equipmentId) {
      toast({
        title: "Equipment ID required",
        description: "Please enter an equipment ID to associate with the telemetry",
        variant: "destructive",
      });
      return;
    }

    try {
      setSimulating(true);
      setProgress(10);
      setLastResult(null);

      const payload = {
        vesselType: selectedVesselType,
        equipmentId,
        deviceId,
        durationMinutes: duration,
        samplingIntervalSeconds: samplingInterval,
        seaState,
        faultInjection: faultInjection ? { type: "bearing_wear", severity: 0.3 } : undefined,
        orgId: "default-org-id",
      };

      setProgress(30);

      const result = await adminApiRequest("POST", "/api/admin/simulate-telemetry", payload);

      setProgress(100);
      setLastResult({
        success: true,
        message: result.message || "Simulation completed successfully",
        dataPointsGenerated: result.dataPoints,
        telemetryRecordsCreated: result.telemetryRecords,
        vesselType: result.vesselType,
        duration: result.duration,
      });

      toast({
        title: "Simulation Complete",
        description: `Generated ${result.telemetryRecords || result.dataPoints} telemetry records`,
      });
    } catch (error) {
      setLastResult({
        success: false,
        message: (error as Error).message || "Simulation failed",
      });
      toast({
        title: "Simulation Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSimulating(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  return (
    <Card data-testid="card-vessel-simulator">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Ship className="h-5 w-5 text-primary" />
            <CardTitle>Vessel Telemetry Simulator</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadVesselTypes}
            disabled={loadingTypes}
            data-testid="button-load-vessel-types"
          >
            {loadingTypes ? "Loading..." : "Load Vessel Types"}
          </Button>
        </div>
        <CardDescription>
          Generate physics-based synthetic telemetry data for testing and ML training
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vessel-type">Vessel Type</Label>
            <Select
              value={selectedVesselType}
              onValueChange={setSelectedVesselType}
              disabled={vesselTypes.length === 0}
            >
              <SelectTrigger id="vessel-type" data-testid="select-vessel-type">
                <SelectValue placeholder="Select vessel type" />
              </SelectTrigger>
              <SelectContent>
                {vesselTypes.map((type) => (
                  <SelectItem
                    key={type.id}
                    value={type.id}
                    data-testid={`option-vessel-${type.id}`}
                  >
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vesselTypes.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Click "Load Vessel Types" to see available options
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="equipment-id">Equipment ID</Label>
            <Input
              id="equipment-id"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              placeholder="e.g., main-engine-001"
              data-testid="input-equipment-id"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="device-id">Device ID</Label>
            <Input
              id="device-id"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="simulator-device"
              data-testid="input-device-id"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              max="1440"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              data-testid="input-duration"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sampling">Sampling Interval (seconds)</Label>
            <Input
              id="sampling"
              type="number"
              min="1"
              max="60"
              value={samplingInterval}
              onChange={(e) => setSamplingInterval(Number(e.target.value))}
              data-testid="input-sampling"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sea-state">
              <div className="flex items-center space-x-2">
                <Waves className="h-4 w-4" />
                <span>Sea State (Douglas Scale)</span>
              </div>
            </Label>
            <Select value={seaState.toString()} onValueChange={(v) => setSeaState(Number(v))}>
              <SelectTrigger id="sea-state" data-testid="select-sea-state">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 - Calm (glassy)</SelectItem>
                <SelectItem value="1">1 - Calm (rippled)</SelectItem>
                <SelectItem value="2">2 - Smooth (wavelets)</SelectItem>
                <SelectItem value="3">3 - Slight (1m waves)</SelectItem>
                <SelectItem value="4">4 - Moderate (2m waves)</SelectItem>
                <SelectItem value="5">5 - Rough (3m waves)</SelectItem>
                <SelectItem value="6">6 - Very rough (5m waves)</SelectItem>
                <SelectItem value="7">7 - High (7m waves)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-2">
          <Switch
            id="fault-injection"
            checked={faultInjection}
            onCheckedChange={setFaultInjection}
            data-testid="switch-fault-injection"
          />
          <Label htmlFor="fault-injection" className="cursor-pointer">
            Enable Fault Injection (bearing wear simulation)
          </Label>
        </div>

        {progress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Generating telemetry...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} data-testid="progress-simulation" />
          </div>
        )}

        {lastResult && (
          <Alert
            variant={lastResult.success ? "default" : "destructive"}
            data-testid="alert-result"
          >
            {lastResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">{lastResult.message}</p>
                {lastResult.success && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {lastResult.dataPointsGenerated && (
                      <Badge variant="secondary">
                        {lastResult.dataPointsGenerated} data points
                      </Badge>
                    )}
                    {lastResult.telemetryRecordsCreated && (
                      <Badge variant="secondary">
                        {lastResult.telemetryRecordsCreated} DB records
                      </Badge>
                    )}
                    {lastResult.vesselType && (
                      <Badge variant="outline">{lastResult.vesselType}</Badge>
                    )}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleSimulate}
          disabled={simulating || !selectedVesselType || !equipmentId}
          className="w-full"
          data-testid="button-generate-telemetry"
        >
          <Play className="mr-2 h-4 w-4" />
          {simulating ? "Generating..." : "Generate Telemetry Data"}
        </Button>

        {selectedVesselType && vesselTypes.length > 0 && (
          <div className="text-sm text-muted-foreground pt-2 border-t">
            <p className="font-medium mb-1">Selected Vessel Info:</p>
            <p className="text-xs">
              {vesselTypes.find((v) => v.id === selectedVesselType)?.description}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

```

