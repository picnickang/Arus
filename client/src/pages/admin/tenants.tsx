import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Push B1 step 5 — Tenant lifecycle admin UI.
 *
 * Intentionally minimal: list / provision / suspend / unsuspend / delete.
 * Deletion delegates to the Wave 6.6 GDPR `TenantDeleteService` and
 * returns an HMAC-signed certificate that's surfaced in a toast so the
 * admin can copy it for the compliance file.
 */
interface TenantRow {
  id: string;
  name: string;
  slug: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  max_storage_bytes: number | null;
  max_equipment_count: number | null;
  max_telemetry_rows_per_day: number | null;
}

export default function AdminTenantsPage() {
  const { toast } = useToast();
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");

  const { data, isLoading } = useQuery<{ tenants: TenantRow[] }>({
    queryKey: ["/api/admin/tenants"],
  });

  const provision = useMutation({
    mutationFn: async (body: { id: string; name: string }) =>
      apiRequest("POST", "/api/admin/tenants", body),
    onSuccess: () => {
      toast({ title: "Tenant provisioned" });
      setNewId("");
      setNewName("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
    },
    onError: (e: any) =>
      toast({
        title: "Provision failed",
        description: String(e?.message ?? e),
        variant: "destructive",
      }),
  });

  const suspend = useMutation({
    mutationFn: async ({ id, suspended }: { id: string; suspended: boolean }) =>
      apiRequest(
        "PATCH",
        `/api/admin/tenants/${id}/${suspended ? "unsuspend" : "suspend"}`,
        suspended ? {} : { reason: "Admin action" }
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/admin/tenants/${id}`, {
        confirm: "DELETE_TENANT",
        reason: "Admin-initiated deletion",
      }),
    onSuccess: (res: any) => {
      toast({
        title: "Tenant deleted",
        description: `Certificate: ${res?.certificate?.certificateId ?? "(see logs)"}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
    },
    onError: (e: any) =>
      toast({
        title: "Delete failed",
        description: String(e?.message ?? e),
        variant: "destructive",
      }),
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Tenant Management</h1>

      <Card>
        <CardHeader>
          <CardTitle>Provision New Tenant</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1">
            <Label htmlFor="tenant-id">Org ID</Label>
            <Input
              id="tenant-id"
              data-testid="input-tenant-id"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="acme-corp"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="tenant-name">Display Name</Label>
            <Input
              id="tenant-name"
              data-testid="input-tenant-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Acme Corporation"
            />
          </div>
          <Button
            data-testid="button-provision-tenant"
            disabled={!newId || !newName || provision.isPending}
            onClick={() =>
              provision.mutate({ id: newId.trim(), name: newName.trim() })
            }
          >
            {provision.isPending ? "Provisioning…" : "Provision"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Org ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quotas</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.tenants ?? []).map((t) => {
                  const suspended = !!t.suspended_at;
                  return (
                    <TableRow
                      key={t.id}
                      data-testid={`row-tenant-${t.id}`}
                    >
                      <TableCell className="font-mono text-sm">
                        {t.id}
                      </TableCell>
                      <TableCell>{t.name}</TableCell>
                      <TableCell>
                        {suspended ? (
                          <Badge variant="destructive">Suspended</Badge>
                        ) : (
                          <Badge>Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {t.max_equipment_count ?? "—"} eq /{" "}
                        {t.max_telemetry_rows_per_day ?? "—"} rows/day
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-toggle-${t.id}`}
                          onClick={() =>
                            suspend.mutate({ id: t.id, suspended })
                          }
                        >
                          {suspended ? "Unsuspend" : "Suspend"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          data-testid={`button-delete-${t.id}`}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Permanently delete tenant ${t.id}? This is irreversible.`
                              )
                            ) {
                              remove.mutate(t.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
