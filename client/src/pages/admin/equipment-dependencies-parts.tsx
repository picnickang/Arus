import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "reactflow";
import { ArrowRight, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Equipment } from "@shared/schema";
import type { DependencyWithEditor, NotesDialogState } from "./equipment-dependencies-model";

interface EquipmentQueryStatus {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

interface DependencyGraphTabProps {
  equipmentList: Equipment[];
  equipmentStatus: EquipmentQueryStatus;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onEdgeClick: (event: React.MouseEvent, edge: Edge) => void;
  isLayoutLoading: boolean;
  isLayoutSaving: boolean;
}

interface DependencyBulkTabProps {
  equipmentList: Equipment[];
  equipmentStatus: EquipmentQueryStatus;
  upstreamId: string;
  downstreamId: string;
  notes: string;
  csvText: string;
  canSubmit: boolean;
  isCreating: boolean;
  isImporting: boolean;
  isDeleting: boolean;
  dependencies: DependencyWithEditor[];
  depsStatus: {
    isLoading: boolean;
    isError: boolean;
    error: unknown;
  };
  setUpstreamId: (value: string) => void;
  setDownstreamId: (value: string) => void;
  setNotes: (value: string) => void;
  setCsvText: (value: string) => void;
  equipmentLabel: (id: string) => string;
  onAddDependency: () => void;
  onImportCsv: () => void;
  onDeleteDependency: (id: string) => void;
}

interface EdgeNotesDialogProps {
  notesDialog: NotesDialogState;
  setNotesDialog: (next: NotesDialogState | ((prev: NotesDialogState) => NotesDialogState)) => void;
  dependencies: DependencyWithEditor[];
  equipmentLabel: (id: string) => string;
  isSaving: boolean;
  isCreating: boolean;
  onSkipCreate: (dialog: Exclude<NotesDialogState, null> & { mode: "create" }) => void;
  onSaveNotes: (dialog: Exclude<NotesDialogState, null>) => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

export function DependencyGraphTab({
  equipmentList,
  equipmentStatus,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onEdgeClick,
  isLayoutLoading,
  isLayoutSaving,
}: DependencyGraphTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dependency map</CardTitle>
        <CardDescription>
          Drag a node by its body to reposition it. Drag from a node's edge handle to another node
          to add a new dependency (upstream → downstream). Select an edge and press Backspace or
          Delete to remove it. Changes auto-save through the existing dependency API.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {equipmentStatus.isError && (
          <p className="text-sm text-destructive mb-2" data-testid="text-graph-equipment-error">
            Couldn't load equipment: {errorMessage(equipmentStatus.error)}
          </p>
        )}
        {equipmentList.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-graph-empty">
            {equipmentStatus.isLoading
              ? "Loading equipment…"
              : "No equipment on this vessel — add equipment before drawing dependencies."}
          </p>
        ) : (
          <div className="h-[600px] w-full border rounded-md bg-background" data-testid="graph-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onEdgeClick={onEdgeClick}
              fitView
              deleteKeyCode={["Backspace", "Delete"]}
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <MiniMap pannable zoomable />
              <Controls />
            </ReactFlow>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2" data-testid="text-layout-save-status">
          {isLayoutSaving
            ? "Saving layout…"
            : isLayoutLoading
              ? "Loading saved layout…"
              : "Your layout is saved per vessel."}
        </p>
      </CardContent>
    </Card>
  );
}

export function DependencyBulkTab({
  equipmentList,
  equipmentStatus,
  upstreamId,
  downstreamId,
  notes,
  csvText,
  canSubmit,
  isCreating,
  isImporting,
  isDeleting,
  dependencies,
  depsStatus,
  setUpstreamId,
  setDownstreamId,
  setNotes,
  setCsvText,
  equipmentLabel,
  onAddDependency,
  onImportCsv,
  onDeleteDependency,
}: DependencyBulkTabProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Add dependency</CardTitle>
          <CardDescription>
            Pick the upstream equipment and the downstream equipment that depends on it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {equipmentStatus.isError && (
            <p className="text-sm text-destructive" data-testid="text-equipment-error">
              Couldn't load equipment for this vessel: {errorMessage(equipmentStatus.error)}
            </p>
          )}
          <DependencySelects
            equipmentList={equipmentList}
            equipmentStatus={equipmentStatus}
            upstreamId={upstreamId}
            downstreamId={downstreamId}
            setUpstreamId={setUpstreamId}
            setDownstreamId={setDownstreamId}
          />
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
          <Button onClick={onAddDependency} disabled={!canSubmit} data-testid="button-add-dependency">
            <Plus className="h-4 w-4 mr-2" />
            {isCreating ? "Adding…" : "Add dependency"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CSV bulk import</CardTitle>
          <CardDescription>
            Paste rows as <code>upstreamEquipmentId,downstreamEquipmentId,notes</code>. Header row
            optional. Duplicate edges are skipped silently; equipment ids must belong to this vessel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={8}
            className="font-mono text-xs"
            placeholder={"upstreamEquipmentId,downstreamEquipmentId,notes\nuuid-a,uuid-b,powers downstream"}
            data-testid="textarea-csv-import"
          />
          <Button
            variant="secondary"
            onClick={onImportCsv}
            disabled={isImporting || !csvText.trim()}
            data-testid="button-import-csv"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isImporting ? "Importing…" : "Import rows"}
          </Button>
        </CardContent>
      </Card>

      <ExistingDependenciesCard
        dependencies={dependencies}
        depsStatus={depsStatus}
        equipmentLabel={equipmentLabel}
        isDeleting={isDeleting}
        onDeleteDependency={onDeleteDependency}
      />
    </>
  );
}

function DependencySelects({
  equipmentList,
  equipmentStatus,
  upstreamId,
  downstreamId,
  setUpstreamId,
  setDownstreamId,
}: Pick<
  DependencyBulkTabProps,
  "equipmentList" | "equipmentStatus" | "upstreamId" | "downstreamId" | "setUpstreamId" | "setDownstreamId"
>) {
  const disabled = equipmentStatus.isLoading || equipmentStatus.isError || equipmentList.length === 0;
  const placeholder = equipmentStatus.isLoading
    ? "Loading equipment…"
    : equipmentStatus.isError
      ? "Equipment unavailable"
      : equipmentList.length === 0
        ? "No equipment on this vessel"
        : undefined;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-1">
        <Label>Upstream (source)</Label>
        <Select value={upstreamId} onValueChange={setUpstreamId}>
          <SelectTrigger data-testid="select-upstream" disabled={disabled}>
            <SelectValue placeholder={placeholder ?? "Choose upstream equipment"} />
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
          <SelectTrigger data-testid="select-downstream" disabled={disabled}>
            <SelectValue placeholder={placeholder ?? "Choose downstream equipment"} />
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
  );
}

function ExistingDependenciesCard({
  dependencies,
  depsStatus,
  equipmentLabel,
  isDeleting,
  onDeleteDependency,
}: Pick<
  DependencyBulkTabProps,
  "dependencies" | "depsStatus" | "equipmentLabel" | "isDeleting" | "onDeleteDependency"
>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Existing dependencies</CardTitle>
        <CardDescription>
          {depsStatus.isLoading
            ? "Loading…"
            : `${dependencies.length} edge${dependencies.length === 1 ? "" : "s"} defined for this vessel.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {depsStatus.isError ? (
          <p className="text-sm text-destructive" data-testid="text-deps-error">
            Failed to load dependencies: {errorMessage(depsStatus.error)}
          </p>
        ) : dependencies.length === 0 && !depsStatus.isLoading ? (
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
                  <TableCell className="text-sm">{equipmentLabel(d.upstreamEquipmentId)}</TableCell>
                  <TableCell>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell className="text-sm">{equipmentLabel(d.downstreamEquipmentId)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.notes ?? "—"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteDependency(d.id)}
                      disabled={isDeleting}
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
  );
}

export function EdgeNotesDialog({
  notesDialog,
  setNotesDialog,
  dependencies,
  equipmentLabel,
  isSaving,
  isCreating,
  onSkipCreate,
  onSaveNotes,
}: EdgeNotesDialogProps) {
  const editDependency =
    notesDialog?.mode === "edit"
      ? dependencies.find((d) => d.id === notesDialog.dependencyId)
      : undefined;

  return (
    <Dialog open={notesDialog !== null} onOpenChange={(open) => !open && setNotesDialog(null)}>
      <DialogContent data-testid="dialog-edge-notes">
        <DialogHeader>
          <DialogTitle>
            {notesDialog?.mode === "create" ? "Add dependency notes" : "Edit dependency notes"}
          </DialogTitle>
          <DialogDescription>
            {notesDialog
              ? `${equipmentLabel(notesDialog.upstreamId)} → ${equipmentLabel(notesDialog.downstreamId)}`
              : null}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="edge-notes">Notes (optional)</Label>
          <Textarea
            id="edge-notes"
            rows={4}
            maxLength={500}
            placeholder="e.g. shared cooling loop"
            value={notesDialog?.notes ?? ""}
            onChange={(e) =>
              setNotesDialog((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
            }
            data-testid="textarea-edge-notes"
          />
          {editDependency?.notesUpdatedAt && (
            <p className="text-xs text-muted-foreground" data-testid="text-edge-notes-last-edited">
              Last edited by {editDependency.notesUpdatedByName ?? "unknown user"} at{" "}
              {new Date(editDependency.notesUpdatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setNotesDialog(null)} data-testid="button-edge-notes-cancel">
            Cancel
          </Button>
          {notesDialog?.mode === "create" && (
            <Button
              variant="secondary"
              onClick={() => onSkipCreate(notesDialog)}
              data-testid="button-edge-notes-skip"
            >
              Skip notes
            </Button>
          )}
          <Button
            onClick={() => notesDialog && onSaveNotes(notesDialog)}
            disabled={isSaving || isCreating}
            data-testid="button-edge-notes-save"
          >
            {notesDialog?.mode === "create" ? "Add edge" : "Save notes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
