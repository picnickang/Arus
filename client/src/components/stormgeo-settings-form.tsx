import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { CloudSun, Loader2, Settings, ShieldCheck } from "lucide-react";
import type { StormGeoSettingsModel } from "./stormgeo-settings-types";

export function StormGeoSettingsForm({ model }: { model: StormGeoSettingsModel }) {
  const { vessels, form, saveSettingsMutation, onSubmitSettings } = model;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudSun className="h-5 w-5" />
          StormGeo Weather Integration
        </CardTitle>
        <CardDescription>
          Configure automatic weather data import from StormGeo for deck logbook auto-fill
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitSettings)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vesselId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vessel (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-stormgeo-vessel">
                          <SelectValue placeholder="All vessels (fleet-wide)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__all__">All vessels (fleet-wide)</SelectItem>
                        {vessels
                          ?.filter((v) => v.id)
                          .map((vessel) => (
                            <SelectItem key={vessel.id} value={vessel.id}>
                              {vessel.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Configure for a specific vessel or apply fleet-wide
                    </FormDescription>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="integrationMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Integration Mode</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-integration-mode">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="file">Manual File Upload</SelectItem>
                        <SelectItem value="api">API Integration</SelectItem>
                        <SelectItem value="sftp">SFTP Auto-Sync</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            {form.watch("integrationMode") === "api" && (
              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">API Connection Settings</CardTitle>
                  <CardDescription>Configure StormGeo API endpoint and credentials</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertDescription>
                      Credentials are stored securely and encrypted on the server.
                    </AlertDescription>
                  </Alert>
                  <FormField
                    control={form.control}
                    name="apiUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API URL</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="https://api.stormgeo.com/v1/weather"
                            data-testid="input-api-url"
                          />
                        </FormControl>
                        <FormDescription>StormGeo API endpoint URL</FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="Enter your StormGeo API key"
                            data-testid="input-api-key"
                          />
                        </FormControl>
                        <FormDescription>Your StormGeo API authentication key</FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pollIntervalMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Poll Interval (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="5"
                            max="1440"
                            {...field}
                            onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 60)}
                            className="w-32"
                            data-testid="input-poll-interval"
                          />
                        </FormControl>
                        <FormDescription>
                          How often to fetch new weather data (5-1440 minutes)
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {form.watch("integrationMode") === "sftp" && (
              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">SFTP Connection Settings</CardTitle>
                  <CardDescription>Configure SFTP server for automatic file sync</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertDescription>
                      Credentials are stored securely and encrypted on the server.
                    </AlertDescription>
                  </Alert>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="sftpHost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SFTP Host</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="sftp.stormgeo.com"
                              data-testid="input-sftp-host"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sftpPort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Port</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) =>
                                field.onChange(Number.parseInt(e.target.value) || 22)
                              }
                              placeholder="22"
                              className="w-24"
                              data-testid="input-sftp-port"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="sftpUser"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="username"
                              data-testid="input-sftp-user"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sftpPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="••••••••"
                              data-testid="input-sftp-password"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="sftpPath"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Remote Path</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="/data/weather/exports"
                            data-testid="input-sftp-path"
                          />
                        </FormControl>
                        <FormDescription>
                          Directory path on the SFTP server to monitor for new files
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pollIntervalMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sync Interval (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="5"
                            max="1440"
                            {...field}
                            onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 60)}
                            className="w-32"
                            data-testid="input-sftp-poll-interval"
                          />
                        </FormControl>
                        <FormDescription>
                          How often to check for new files (5-1440 minutes)
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Integration</Label>
                <p className="text-sm text-muted-foreground">
                  Allow weather data to be fetched from StormGeo
                </p>
              </div>
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-stormgeo-enabled"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-fill Deck Log</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically populate weather fields in hourly log entries
                </p>
              </div>
              <FormField
                control={form.control}
                name="autoFillEnabled"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-autofill-enabled"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Overwrite Manual Entries</Label>
                <p className="text-sm text-muted-foreground">
                  Replace manually entered weather data when auto-filling
                </p>
              </div>
              <FormField
                control={form.control}
                name="overwriteManualEntries"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-overwrite-manual"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="confidenceThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confidence Threshold</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      {...field}
                      onChange={(e) => field.onChange(Number.parseFloat(e.target.value))}
                      className="w-32"
                      data-testid="input-confidence-threshold"
                    />
                  </FormControl>
                  <FormDescription>
                    Minimum confidence score (0-1) to auto-fill weather data
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Optional configuration notes..."
                      data-testid="input-stormgeo-notes"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="submit"
                disabled={saveSettingsMutation.isPending}
                data-testid="button-save-stormgeo-settings"
              >
                {saveSettingsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
