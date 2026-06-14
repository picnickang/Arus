import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SystemSettingsTab } from "@/components/admin/SystemSettingsTab";
import { useConfigurationTabData } from "@/features/settings";
import { Eye, EyeOff, Key, Users } from "lucide-react";

export function ConfigurationTab() {
  const c = useConfigurationTabData();

  return (
    <div className="space-y-4">
      <SystemSettingsTab />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Access & Security
          </CardTitle>
          <CardDescription>Manage user permissions and authentication settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="pb-4 border-b">
            <div className="flex items-center justify-center py-6">
              <div className="text-center space-y-2">
                <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground max-w-md">
                  User roles and permissions management coming soon.
                </p>
              </div>
            </div>
          </div>
          <Collapsible open={c.passwordSectionOpen} onOpenChange={c.setPasswordSectionOpen}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Change Admin Password</h4>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="button-toggle-password-change">
                  {c.passwordSectionOpen ? "Cancel" : "Change Password"}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="pt-4">
              <Form {...c.passwordForm}>
                <form
                  onSubmit={c.passwordForm.handleSubmit(c.handlePasswordSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={c.passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter current password"
                            data-testid="input-current-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={c.passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={c.showPassword ? "text" : "password"}
                              placeholder="Enter new password"
                              data-testid="input-new-password"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => c.setShowPassword(!c.showPassword)}
                              data-testid="button-toggle-password-visibility"
                            >
                              {c.showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Must be at least 8 characters with uppercase, lowercase, and number
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={c.passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input
                            type={c.showPassword ? "text" : "password"}
                            placeholder="Confirm new password"
                            data-testid="input-confirm-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={c.cancelPasswordChange}
                      data-testid="button-cancel-password-change"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={c.changePasswordMutation.isPending}
                      data-testid="button-submit-password-change"
                    >
                      {c.changePasswordMutation.isPending ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  );
}
