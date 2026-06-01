import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Link2, Search } from "lucide-react";
import {
  UserAccessEditor,
  previewLine,
  type CrewUser,
  type RoleSummary,
  type VesselLite,
} from "./UserAccessEditor";

interface CrewLite {
  id: string;
  name: string;
  userId: string | null;
}

export function UserAssignmentTab() {
  const { toast } = useToast();
  const onError = (error: unknown) =>
    toast({
      title: "Action failed",
      description: error instanceof Error ? error.message : "Please try again.",
      variant: "destructive",
    });

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [linkUserId, setLinkUserId] = useState<string | null>(null);
  const [linkCrewId, setLinkCrewId] = useState("");
  const [search, setSearch] = useState("");

  const { data: users = [] } = useQuery<CrewUser[]>({
    queryKey: ["/api/admin/crew/users"],
  });
  const { data: roles = [] } = useQuery<RoleSummary[]>({
    queryKey: ["/api/admin/crew/roles"],
  });
  const { data: vessels = [] } = useQuery<VesselLite[]>({ queryKey: ["/api/vessels"] });
  const { data: crew = [] } = useQuery<CrewLite[]>({ queryKey: ["/api/crew"] });

  // "User Accounts" surfaces only logins NOT tied to a crew member — crew-linked
  // accounts are managed from the crew member's profile (Crew Roster).
  const standalone = users.filter((u) => !u.linkedCrewId);
  const term = search.trim().toLowerCase();
  const filtered = term
    ? standalone.filter((u) =>
        [u.name, u.email, u.username]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(term)),
      )
    : standalone;

  const editing = users.find((u) => u.id === editUserId) ?? null;
  const unlinkedCrew = crew.filter((c) => !c.userId);

  const link = useMutation({
    mutationFn: async () => {
      if (!linkUserId || !linkCrewId) return;
      await apiRequest("POST", `/api/admin/crew/members/${linkCrewId}/link`, {
        userId: linkUserId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crew/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crew/access-readiness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crew"] });
      setLinkUserId(null);
      setLinkCrewId("");
      toast({ title: "Account linked to crew member" });
    },
    onError,
  });

  return (
    <div className="space-y-4" data-testid="tab-content-assignment">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">User Accounts</CardTitle>
          <CardDescription>
            Logins that are not tied to a crew member. To manage a crew member's login, open
            their profile in the Crew Roster.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or username"
              className="pl-8"
              data-testid="input-search-accounts"
            />
          </div>
          {filtered.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              data-testid={`row-user-${u.id}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{u.name ?? u.email}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {roles.find((r) => r.name === u.role)?.displayName ?? u.role}
                  </Badge>
                  {(u.assignedRoleNames ?? []).filter((n) => n !== u.role).length > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-[10px]"
                      data-testid={`badge-extra-roles-${u.id}`}
                    >
                      +{(u.assignedRoleNames ?? []).filter((n) => n !== u.role).length} role
                    </Badge>
                  )}
                  {u.loginEnabled ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Login on
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Login off
                    </Badge>
                  )}
                  {u.mustChangePassword && (
                    <Badge variant="outline" className="text-[10px]">
                      Must change pw
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {previewLine(u, roles, vessels)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setLinkUserId(u.id);
                    setLinkCrewId("");
                  }}
                  data-testid={`button-link-user-${u.id}`}
                >
                  <Link2 className="h-4 w-4 mr-1" /> Link to crew
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditUserId(u.id)}
                  data-testid={`button-edit-user-${u.id}`}
                >
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {standalone.length === 0
                ? "No standalone accounts — every login is tied to a crew member."
                : "No accounts match your search."}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={editUserId !== null} onOpenChange={(o) => !o && setEditUserId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.name ?? editing?.email ?? "Edit User"}</DialogTitle>
            <DialogDescription>
              {editing ? previewLine(editing, roles, vessels) : ""}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <UserAccessEditor
              user={editing}
              roles={roles}
              vessels={vessels}
              allUsers={users}
              onSaved={() => setEditUserId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={linkUserId !== null} onOpenChange={(o) => !o && setLinkUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link account to crew member</DialogTitle>
            <DialogDescription>
              Attach this login to a crew member who does not yet have one.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Crew member</Label>
            <Select value={linkCrewId} onValueChange={setLinkCrewId}>
              <SelectTrigger data-testid="select-link-crew">
                <SelectValue placeholder="Select a crew member" />
              </SelectTrigger>
              <SelectContent>
                {unlinkedCrew.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {unlinkedCrew.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Every crew member already has a login account.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLinkUserId(null)}
              data-testid="button-cancel-link"
            >
              Cancel
            </Button>
            <Button
              onClick={() => link.mutate()}
              disabled={!linkCrewId || link.isPending}
              data-testid="button-confirm-link"
            >
              Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
