import {
  Building,
  Crown,
  Edit,
  Eye,
  Key,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrganizationManagementModel } from "./organization-management-types";

interface OrganizationManagementSectionsProps {
  m: OrganizationManagementModel;
}

function getRoleIcon(role: string) {
  switch (role) {
    case "admin":
      return <Crown className="h-4 w-4" />;
    case "manager":
      return <ShieldCheck className="h-4 w-4" />;
    case "technician":
      return <Wrench className="h-4 w-4" />;
    default:
      return <Eye className="h-4 w-4" />;
  }
}

export function OrganizationManagementSections({ m }: OrganizationManagementSectionsProps) {
  return (
    <>
      <div className="px-4 md:px-6 py-4 flex flex-wrap items-center justify-end gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search organizations or users..."
            value={m.searchTerm}
            onChange={(e) => m.setSearchTerm(e.target.value)}
            className="pl-10 w-full md:w-80 min-h-[44px] touch-manipulation"
            data-testid="input-search"
          />
        </div>
        <Button
          onClick={() => m.openOrganizationDialog()}
          className="min-h-[44px] touch-manipulation"
          data-testid="button-add-organization"
        >
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Add Organization</span>
          <span className="sm:hidden">Add Org</span>
        </Button>
      </div>

      <div className="px-4 md:px-6 space-y-4 md:space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building className="mr-2 h-5 w-5" />
              Organizations ({m.filteredOrganizations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {m.organizationsLoading ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Loading organizations...
              </div>
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {m.filteredOrganizations.map(
                        (org: (typeof m.filteredOrganizations)[number]) => (
                          <TableRow
                            key={org.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => m.setSelectedOrgId(org.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                m.setSelectedOrgId(org.id);
                              }
                            }}
                            tabIndex={0}
                            data-testid={`row-organization-${org.id}`}
                          >
                            <TableCell className="font-medium">{org.name}</TableCell>
                            <TableCell className="font-mono text-sm">{org.slug}</TableCell>
                            <TableCell>
                              <Badge className={m.getTierColor(org.subscriptionTier)}>
                                {org.subscriptionTier}
                              </Badge>
                            </TableCell>
                            <TableCell>{org.maxUsers}</TableCell>
                            <TableCell>{org.maxEquipment}</TableCell>
                            <TableCell>
                              <Badge variant={org.isActive ? "default" : "secondary"}>
                                {org.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    m.openOrganizationDialog(org);
                                  }}
                                  data-testid={`button-edit-organization-${org.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    m.handleDeleteOrganization(org.id);
                                  }}
                                  data-testid={`button-delete-organization-${org.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="md:hidden space-y-3">
                  {m.filteredOrganizations.map((org: (typeof m.filteredOrganizations)[number]) => (
                    <Card
                      key={org.id}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          m.setSelectedOrgId(org.id);
                        }
                      }}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => m.setSelectedOrgId(org.id)}
                      data-testid={`card-organization-${org.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-base truncate">{org.name}</h3>
                              <p className="text-sm text-muted-foreground font-mono">{org.slug}</p>
                            </div>
                            <div className="flex flex-col items-end space-y-1">
                              <Badge className={m.getTierColor(org.subscriptionTier)}>
                                {org.subscriptionTier}
                              </Badge>
                              <Badge
                                variant={org.isActive ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {org.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Max Users:</span>
                              <div className="font-medium">{org.maxUsers}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Max Equipment:</span>
                              <div className="font-medium">{org.maxEquipment}</div>
                            </div>
                          </div>
                          <div
                            className="flex space-x-2 pt-2"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 min-h-[44px] touch-manipulation"
                              onClick={() => m.openOrganizationDialog(org)}
                              data-testid={`button-edit-organization-${org.id}`}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-h-[44px] touch-manipulation"
                              onClick={() => m.handleDeleteOrganization(org.id)}
                              data-testid={`button-delete-organization-${org.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {m.selectedOrgId && (
          <Card>
            <CardHeader>
              <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0">
                <CardTitle className="flex items-center text-lg md:text-xl">
                  <Users className="mr-2 h-5 w-5" />
                  Users ({m.filteredUsers.length})
                </CardTitle>
                <Button
                  onClick={() => m.openUserDialog()}
                  className="min-h-[44px] touch-manipulation"
                  data-testid="button-add-user"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {m.usersLoading ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Loading users...
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last Login</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {m.filteredUsers.map((user: (typeof m.filteredUsers)[number]) => (
                          <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                {getRoleIcon(user.role)}
                                <span className="capitalize">{user.role}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.isActive ? "default" : "secondary"}>
                                {user.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {user.lastLoginAt
                                ? new Date(user.lastLoginAt).toLocaleDateString()
                                : "Never"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => m.openUserDialog(user)}
                                  data-testid={`button-edit-user-${user.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => m.openPasswordDialog(user.id)}
                                  data-testid={`button-password-user-${user.id}`}
                                >
                                  <Key className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => m.handleDeleteUser(user.id)}
                                  data-testid={`button-delete-user-${user.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="md:hidden space-y-3">
                    {m.filteredUsers.map((user: (typeof m.filteredUsers)[number]) => (
                      <Card key={user.id} data-testid={`card-user-${user.id}`}>
                        <CardContent className="p-4">
                          <div className="flex flex-col space-y-3">
                            <div className="flex justify-between items-start">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-medium text-base truncate">{user.name}</h3>
                                <p className="text-sm text-muted-foreground truncate">
                                  {user.email}
                                </p>
                              </div>
                              <Badge
                                variant={user.isActive ? "default" : "secondary"}
                                className="text-xs flex-shrink-0 ml-2"
                              >
                                {user.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">Role:</span>
                                <div className="font-medium flex items-center space-x-1">
                                  {getRoleIcon(user.role)}
                                  <span className="capitalize">{user.role}</span>
                                </div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Last Login:</span>
                                <div className="font-medium">
                                  {user.lastLoginAt
                                    ? new Date(user.lastLoginAt).toLocaleDateString()
                                    : "Never"}
                                </div>
                              </div>
                            </div>
                            <div className="flex space-x-2 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 min-h-[44px] touch-manipulation"
                                onClick={() => m.openUserDialog(user)}
                                data-testid={`button-edit-user-${user.id}`}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-h-[44px] touch-manipulation"
                                onClick={() => m.openPasswordDialog(user.id)}
                                data-testid={`button-password-user-mobile-${user.id}`}
                              >
                                <Key className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-h-[44px] touch-manipulation"
                                onClick={() => m.handleDeleteUser(user.id)}
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
