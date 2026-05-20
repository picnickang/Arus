import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Upload, ArrowRight } from "lucide-react";
import type {
  Equipment,
  Vessel,
  EquipmentDependency,
} from "@shared/schema";

interface DependenciesResponse {
  dependencies: EquipmentDependency[];
}

interface CsvRow {
  upstreamEquipmentId: string;
  downstreamEquipmentId: string;
  notes?: string | null;
}

/**
 * Parse the CSV body the admin pastes into the import textarea. We
 * deliberately accept the simplest possible shape so an operator
 * editing a spreadsheet doesn't need to fight quoting:
 *
 *   upstreamEquipmentId,downstreamEquipmentId[,notes]
 *
 * Header row optional. Blank lines + `#`-comment lines ignored.
 */
function parseCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: CsvRow[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith("#")) continue;
    const parts = raw.split(",").map((p) => p.trim());
    // Skip header row.
    if (i === 0 && /upstream/i.test(parts[0] ?? "")) continue;
    if (parts.length < 2) {
      errors.push(`Line ${i + 1}: need at least 2 columns`);
      continue;
    }
    const [up, down, notes] = parts;
    if (!up || !down) {
      errors.push(`Line ${i + 1}: missing upstream or downstream id`);
      continue;
    }
    if (up === down) {
      errors.push(`Line ${i + 1}: self-loop (${up})`);
      continue;
    }
    rows.push({
      upstreamEquipmentId: up,
      downstreamEquipmentId: down,
      notes: notes && notes.length > 0 ? notes : null,
    });
  }
  return { rows, errors };
}

export default function EquipmentDependenciesPage() {
  const { toast } = useToast();
  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [upstreamId, setUpstreamId] = useState<string>("");
  const [downstreamId, setDownstreamId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [csvText, setCsvText] = useState<string>("");

  const vesselsQuery = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  const vessels = vesselsQuery.data ?? [];

  const vesselsErr = vesselsQuery.error as Error | null;
  const isForbidden =
    !!vesselsErr &&
    (/^403:/.test(vesselsErr.message) || /forbidden/i.test(vesselsErr.message));

  const equipmentQuery = useQuery<Equipment[]>({
    queryKey: ["/api/equipment", { vesselId: selectedVesselId }],
    queryFn: async () => {
      const res = await fetch(
        `/api/equipment?vesselId=${encodeURIComponent(selectedVesselId)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!selectedVesselId,
  });
  const equipmentList = equipmentQuery.data ?? [];

  const equipmentById = useMemo(() => {
    const m = new Map<string, Equipment>();
    for (const e of equipmentList) m.set(e.id, e);
    return m;
  }, [equipmentList]);

  const depsQuery = useQuery<DependenciesResponse>({
    queryKey: ["/api/v1/vessels", selectedVesselId, "equipment-dependencies"],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/vessels/${encodeURIComponent(selectedVesselId)}/equipment-dependencies`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!selectedVesselId,
  });
  const dependencies = depsQuery.data?.dependencies ?? [];

  const invalidateDeps = () =>
    queryClient.invalidateQueries({
      queryKey: ["/api/v1/vessels", selectedVesselId, "equipment-dependencies"],
    });

  const createMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/v1/equipment-dependencies", {
        vesselId: selectedVesselId,
        upstreamEquipmentId: upstreamId,
        downstreamEquipmentId: downstreamId,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast({ title: "Dependency added" });
      setUpstreamId("");
      setDownstreamId("");
      setNotes("");
      invalidateDeps();
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to add dependency",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/v1/equipment-dependencies/${id}`),
    onSuccess: () => {
      toast({ title: "Dependency removed" });
      invalidateDeps();
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to remove dependency",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (rows: CsvRow[]) =>
      apiRequest<{ ok: true; inserted: number; skipped: number }>(
        "POST",
        `/api/v1/vessels/${encodeURIComponent(selectedVesselId)}/equipment-dependencies/import-csv`,
        { rows }
      ),
    onSuccess: (result) => {
      toast({
        title: "Import complete",
        description: `Inserted ${result.inserted}, skipped ${result.skipped} (duplicates).`,
      });
      setCsvText("");
      invalidateDeps();
    },
    onError: (err: Error) => {
      toast({
        title: "Import failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (isForbidden) {
    return (
      <div className="p-6" data-testid="page-equipment-deps-forbidden">
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <h1 className="text-lg font-semibold">Admin only</h1>
            <p className="text-sm text-muted-foreground">
              You need the admin or chief engineer role to manage equipment
              dependencies.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const equipmentLabel = (id: string): string => {
    const e = equipmentById.get(id);
    return e ? `${e.name} (${e.id.slice(0, 8)}…)` : id;
  };

  const canSubmit =
    !!selectedVesselId &&
    !!upstreamId &&
    !!downstreamId &&
    upstreamId !== downstreamId &&
    !createMutation.isPending;

  return (
    <div className="p-6 space-y-6" data-testid="page-equipment-dependencies">
      <div>
        <h1 className="text-2xl font-bold">Equipment Dependencies</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Draw the dependency map for blast-radius reasoning. Upstream → downstream
          edges feed the failure-propagation graph used by the 3D viewer and the
          Copilot agent.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vessel</CardTitle>
          <CardDescription>Select a vessel to edit its dependency map.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
            <SelectTrigger
              className="max-w-md"
              data-testid="select-vessel"
              disabled={vesselsQuery.isLoading || vessels.length === 0}
            >
              <SelectValue
                placeholder={
                  vesselsQuery.isLoading
                    ? "Loading vessels…"
                    : vessels.length === 0
                      ? "No vessels available"
                      : "Choose a vessel"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {vessels.map((v) => (
                <SelectItem key={v.id} value={v.id} data-testid={`option-vessel-${v.id}`}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedVesselId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Add dependency</CardTitle>
              <CardDescription>
                Pick the upstream equipment (the source of the dependency) and the
                downstream equipment that depends on it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {equipmentQuery.isError && (
                <p
                  className="text-sm text-destructive"
                  data-testid="text-equipment-error"
                >
                  Couldn't load equipment for this vessel:{" "}
                  {equipmentQuery.error instanceof Error
                    ? equipmentQuery.error.message
                    : "unknown error"}
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Upstream (source)</Label>
                  <Select value={upstreamId} onValueChange={setUpstreamId}>
                    <SelectTrigger
                      data-testid="select-upstream"
                      disabled={
                        equipmentQuery.isLoading ||
                        equipmentQuery.isError ||
                        equipmentList.length === 0
                      }
                    >
                      <SelectValue
                        placeholder={
                          equipmentQuery.isLoading
                            ? "Loading equipment…"
                            : equipmentQuery.isError
                              ? "Equipment unavailable"
                              : equipmentList.length === 0
                                ? "No equipment on this vessel"
                                : "Choose upstream equipment"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {equipmentList.map((e) => (
                        <SelectItem key={e.id} value={e.id} data-testid={`option-upstream-${e.id}`}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Downstream (depends on upstream)</Label>
                  <Select value={downstreamId} onValueChange={setDownstreamId}>
                    <SelectTrigger
                      data-testid="select-downstream"
                      disabled={
                        equipmentQuery.isLoading ||
                        equipmentQuery.isError ||
                        equipmentList.length === 0
                      }
                    >
                      <SelectValue
                        placeholder={
                          equipmentQuery.isLoading
                            ? "Loading equipment…"
                            : equipmentQuery.isError
                              ? "Equipment unavailable"
                              : equipmentList.length === 0
                                ? "No equipment on this vessel"
                                : "Choose downstream equipment"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {equipmentList
                        .filter((e) => e.id !== upstreamId)
                        .map((e) => (
                          <SelectItem key={e.id} value={e.id} data-testid={`option-downstream-${e.id}`}>
                            {e.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Notes (optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. shared cooling loop"
                  data-testid="input-notes"
                />
              </div>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit}
                data-testid="button-add-dependency"
              >
                <Plus className="h-4 w-4 mr-2" />
                {createMutation.isPending ? "Adding…" : "Add dependency"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CSV bulk import</CardTitle>
              <CardDescription>
                Paste rows as <code>upstreamEquipmentId,downstreamEquipmentId,notes</code>.
                Header row optional. Duplicate edges are skipped silently; equipment ids
                must belong to this vessel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={8}
                className="font-mono text-xs"
                placeholder={
                  "upstreamEquipmentId,downstreamEquipmentId,notes\nuuid-a,uuid-b,powers downstream"
                }
                data-testid="textarea-csv-import"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  const parsed = parseCsv(csvText);
                  if (parsed.errors.length > 0) {
                    toast({
                      title: "CSV has errors",
                      description: parsed.errors.slice(0, 5).join("; "),
                      variant: "destructive",
                    });
                    return;
                  }
                  if (parsed.rows.length === 0) {
                    toast({
                      title: "Nothing to import",
                      description: "Paste at least one row.",
                      variant: "destructive",
                    });
                    return;
                  }
                  importMutation.mutate(parsed.rows);
                }}
                disabled={importMutation.isPending || !csvText.trim()}
                data-testid="button-import-csv"
              >
                <Upload className="h-4 w-4 mr-2" />
                {importMutation.isPending ? "Importing…" : "Import rows"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing dependencies</CardTitle>
              <CardDescription>
                {depsQuery.isLoading
                  ? "Loading…"
                  : `${dependencies.length} edge${dependencies.length === 1 ? "" : "s"} defined for this vessel.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {depsQuery.isError ? (
                <p
                  className="text-sm text-destructive"
                  data-testid="text-deps-error"
                >
                  Failed to load dependencies:{" "}
                  {depsQuery.error instanceof Error
                    ? depsQuery.error.message
                    : "unknown error"}
                </p>
              ) : dependencies.length === 0 && !depsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground" data-testid="text-deps-empty">
                  No dependencies yet. Add one above or paste a CSV.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Upstream</TableHead>
                      <TableHead></TableHead>
                      <TableHead>Downstream</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dependencies.map((d) => (
                      <TableRow key={d.id} data-testid={`row-dependency-${d.id}`}>
                        <TableCell className="text-sm">
                          {equipmentLabel(d.upstreamEquipmentId)}
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell className="text-sm">
                          {equipmentLabel(d.downstreamEquipmentId)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {d.notes ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(d.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${d.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
