import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Mail, Bell, FileText, ChevronRight } from "lucide-react";
import { useSystemSettingsTabData } from "@/features/settings";
import { useLocation } from "wouter";
import type { AdminSystemSetting } from "@shared/schema";
import { OpenAIKeyCard } from "./SystemSettingsOpenAIKeyCard";

function SystemSettingsTabContent() {
  const [, setLocation] = useLocation();
  const {
    settings,
    isLoading,
    form,
    createDialogOpen,
    setCreateDialogOpen,
    editingItem,
    createMutation,
    updateMutation,
    deleteMutation,
    handleSubmit,
    handleEdit,
    handleDelete,
    handleCloseDialog,
    handleOpenCreate,
    navigateToEmailSettings,
    navigateToNotificationSettings,
  } = useSystemSettingsTabData();

  const navigateToScheduledReportsSettings = () => setLocation("/scheduled-reports-settings");

  if (isLoading) {
    return <div className="flex items-center justify-center py-8">Loading system settings...</div>;
  }

  return (
    <div className="space-y-6">
      <OpenAIKeyCard />

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={navigateToEmailSettings}
          data-testid="card-email-settings"
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Email & Alerts Settings</CardTitle>
                  <CardDescription className="text-sm">
                    Configure email providers, alert thresholds, and notifications
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={navigateToNotificationSettings}
          data-testid="card-notification-settings"
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Notification Settings</CardTitle>
                  <CardDescription className="text-sm">
                    Manage in-app notifications and push notification preferences
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={navigateToScheduledReportsSettings}
          data-testid="card-scheduled-reports-settings"
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Scheduled Reports Settings</CardTitle>
                  <CardDescription className="text-sm">
                    Configure report retention, defaults, and generation limits
                  </CardDescription>
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
          <p className="text-sm text-muted-foreground">
            Manage application configuration and system parameters
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-setting" onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Setting
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Edit System Setting" : "Create System Setting"}
              </DialogTitle>
              <DialogDescription>
                {editingItem
                  ? "Modify the system setting details"
                  : "Add a new system configuration parameter"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="system">System</SelectItem>
                            <SelectItem value="security">Security</SelectItem>
                            <SelectItem value="performance">Performance</SelectItem>
                            <SelectItem value="integration">Integration</SelectItem>
                            <SelectItem value="ui">User Interface</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., max_upload_size"
                          data-testid="input-key"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 10485760" data-testid="input-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Optional description of this setting"
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isPublic"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Public Setting</FormLabel>
                        <FormDescription>
                          Make this setting visible to non-admin users
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-public"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-setting"
                  >
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
                <TableHead>Category</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.map((setting: AdminSystemSetting) => (
                <TableRow key={setting.id}>
                  <TableCell>
                    <Badge variant="outline" data-testid={`badge-category-${setting.id}`}>
                      {setting.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`text-key-${setting.id}`}>
                    {setting.key}
                  </TableCell>
                  <TableCell className="max-w-xs truncate" data-testid={`text-value-${setting.id}`}>
                    {JSON.stringify(setting.value)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={setting.isSecret ? "destructive" : "default"}
                      data-testid={`badge-status-${setting.id}`}
                    >
                      {setting.isSecret ? "Secret" : "Public"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(setting)}
                        data-testid={`button-edit-${setting.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(setting.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${setting.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {settings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No system settings configured. Add your first setting to get started.
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

export const SystemSettingsTab = memo(SystemSettingsTabContent);
