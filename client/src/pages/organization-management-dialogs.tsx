import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrganizationManagementModel } from "./organization-management-types";

interface OrganizationManagementDialogsProps {
  m: OrganizationManagementModel;
}

export function OrganizationManagementDialogs({ m }: OrganizationManagementDialogsProps) {
  return (
    <>
      <Dialog open={m.organizationDialogOpen} onOpenChange={m.setOrganizationDialogOpen}>
        <DialogContent className="max-w-2xl mx-4 md:mx-0" data-testid="dialog-organization">
          <DialogHeader>
            <DialogTitle>
              {m.editingOrganization ? "Edit Organization" : "Create Organization"}
            </DialogTitle>
          </DialogHeader>
          <Form {...m.organizationForm}>
            <form
              onSubmit={m.organizationForm.handleSubmit(
                m.editingOrganization ? m.handleUpdateOrganization : m.handleCreateOrganization
              )}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={m.organizationForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Acme Corp"
                          className="min-h-[44px] touch-manipulation"
                          {...field}
                          data-testid="input-org-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={m.organizationForm.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="acme-corp"
                          className="min-h-[44px] touch-manipulation"
                          {...field}
                          data-testid="input-org-slug"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={m.organizationForm.control}
                  name="subscriptionTier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subscription Tier</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger
                            className="min-h-[44px] touch-manipulation"
                            data-testid="select-org-tier"
                          >
                            <SelectValue placeholder="Select tier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={m.organizationForm.control}
                  name="billingEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="billing@acme.com"
                          className="min-h-[44px] touch-manipulation"
                          {...field}
                          value={field.value ?? ""}
                          data-testid="input-org-billing"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={m.organizationForm.control}
                  name="maxUsers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Users</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="50"
                          className="min-h-[44px] touch-manipulation"
                          {...field}
                          onChange={(e) => field.onChange(Number.parseInt(e.target.value))}
                          data-testid="input-org-max-users"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={m.organizationForm.control}
                  name="maxEquipment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Equipment</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1000"
                          className="min-h-[44px] touch-manipulation"
                          {...field}
                          onChange={(e) => field.onChange(Number.parseInt(e.target.value))}
                          data-testid="input-org-max-equipment"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex flex-col md:flex-row md:justify-end space-y-2 md:space-y-0 md:space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] touch-manipulation"
                  onClick={() => m.setOrganizationDialogOpen(false)}
                  data-testid="button-cancel-organization"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="min-h-[44px] touch-manipulation"
                  data-testid="button-submit-organization"
                >
                  {m.editingOrganization ? "Update Organization" : "Create Organization"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={m.userDialogOpen} onOpenChange={m.setUserDialogOpen}>
        <DialogContent className="max-w-2xl mx-4 md:mx-0" data-testid="dialog-user">
          <DialogHeader>
            <DialogTitle>{m.editingUser ? "Edit User" : "Create User"}</DialogTitle>
          </DialogHeader>
          <Form {...m.userForm}>
            <form
              onSubmit={m.userForm.handleSubmit(
                m.editingUser ? m.handleUpdateUser : m.handleCreateUser
              )}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={m.userForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Doe"
                          className="min-h-[44px] touch-manipulation"
                          {...field}
                          data-testid="input-user-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={m.userForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="john@acme.com"
                          className="min-h-[44px] touch-manipulation"
                          {...field}
                          data-testid="input-user-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={m.userForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger
                          className="min-h-[44px] touch-manipulation"
                          data-testid="select-user-role"
                        >
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="technician">Technician</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex flex-col md:flex-row md:justify-end space-y-2 md:space-y-0 md:space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] touch-manipulation"
                  onClick={() => m.setUserDialogOpen(false)}
                  data-testid="button-cancel-user"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="min-h-[44px] touch-manipulation"
                  data-testid="button-submit-user"
                >
                  {m.editingUser ? "Update User" : "Create User"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={m.passwordDialogOpen} onOpenChange={m.setPasswordDialogOpen}>
        <DialogContent className="max-w-md mx-4 md:mx-0" data-testid="dialog-password">
          <DialogHeader>
            <DialogTitle>Set User Password</DialogTitle>
          </DialogHeader>
          <Form {...m.passwordForm}>
            <form onSubmit={m.passwordForm.handleSubmit(m.handleSetPassword)} className="space-y-4">
              <FormField
                control={m.passwordForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter new password"
                        className="min-h-[44px] touch-manipulation"
                        {...field}
                        data-testid="input-new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={m.passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Confirm new password"
                        className="min-h-[44px] touch-manipulation"
                        {...field}
                        data-testid="input-confirm-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex flex-col md:flex-row md:justify-end space-y-2 md:space-y-0 md:space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] touch-manipulation"
                  onClick={() => m.setPasswordDialogOpen(false)}
                  data-testid="button-cancel-password"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="min-h-[44px] touch-manipulation"
                  data-testid="button-submit-password"
                >
                  Set Password
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
