import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import "reactflow/dist/style.css";
import {
  DependencyBulkTab,
  DependencyGraphTab,
  EdgeNotesDialog,
} from "./equipment-dependencies-parts";
import { useEquipmentDependenciesPageState } from "./equipment-dependencies-state";

export default function EquipmentDependenciesPage() {
  const state = useEquipmentDependenciesPageState();

  if (state.isForbidden) {
    return (
      <div className="p-6" data-testid="page-equipment-deps-forbidden">
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <h1 className="text-lg font-semibold">Admin only</h1>
            <p className="text-sm text-muted-foreground">
              You need the admin or chief engineer role to manage equipment dependencies.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-equipment-dependencies">
      <div>
        <h1 className="text-2xl font-bold">Equipment Dependencies</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Draw the dependency map for blast-radius reasoning. Upstream → downstream edges feed the
          failure-propagation graph used by the 3D viewer and the Copilot agent.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vessel</CardTitle>
          <CardDescription>Select a vessel to edit its dependency map.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={state.selectedVesselId} onValueChange={state.setSelectedVesselId}>
            <SelectTrigger
              className="max-w-md"
              data-testid="select-vessel"
              disabled={state.vesselsQuery.isLoading || state.vessels.length === 0}
            >
              <SelectValue
                placeholder={
                  state.vesselsQuery.isLoading
                    ? "Loading vessels…"
                    : state.vessels.length === 0
                      ? "No vessels available"
                      : "Choose a vessel"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {state.vessels.map((vessel) => (
                <SelectItem
                  key={vessel.id}
                  value={vessel.id}
                  data-testid={`option-vessel-${vessel.id}`}
                >
                  {vessel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {state.selectedVesselId && (
        <Tabs defaultValue="graph" className="space-y-4">
          <TabsList>
            <TabsTrigger value="graph" data-testid="tab-graph">
              Graph
            </TabsTrigger>
            <TabsTrigger value="bulk" data-testid="tab-bulk">
              Bulk edit (form / CSV)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="graph" className="space-y-4">
            <DependencyGraphTab
              equipmentList={state.equipmentList}
              equipmentStatus={state.equipmentStatus}
              nodes={state.nodes}
              edges={state.edges}
              onNodesChange={state.onNodesChange}
              onEdgesChange={state.onEdgesChange}
              onConnect={state.onConnect}
              onEdgeClick={state.onEdgeClick}
              isLayoutLoading={state.layoutStatus.isLoading}
              isLayoutSaving={state.layoutStatus.isSaving}
            />
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            <DependencyBulkTab
              equipmentList={state.equipmentList}
              equipmentStatus={state.equipmentStatus}
              upstreamId={state.bulk.upstreamId}
              downstreamId={state.bulk.downstreamId}
              notes={state.bulk.notes}
              csvText={state.bulk.csvText}
              canSubmit={state.bulk.canSubmit}
              isCreating={state.bulk.isCreating}
              isImporting={state.bulk.isImporting}
              isDeleting={state.bulk.isDeleting}
              dependencies={state.bulk.dependencies}
              depsStatus={state.bulk.depsStatus}
              setUpstreamId={state.bulk.setUpstreamId}
              setDownstreamId={state.bulk.setDownstreamId}
              setNotes={state.bulk.setNotes}
              setCsvText={state.bulk.setCsvText}
              equipmentLabel={state.bulk.equipmentLabel}
              onAddDependency={state.bulk.onAddDependency}
              onImportCsv={state.bulk.onImportCsv}
              onDeleteDependency={state.bulk.onDeleteDependency}
            />
          </TabsContent>
        </Tabs>
      )}

      <EdgeNotesDialog
        notesDialog={state.notes.notesDialog}
        setNotesDialog={state.notes.setNotesDialog}
        dependencies={state.notes.dependencies}
        equipmentLabel={state.notes.equipmentLabel}
        isSaving={state.notes.isSaving}
        isCreating={state.notes.isCreating}
        onSkipCreate={state.notes.onSkipCreate}
        onSaveNotes={state.notes.onSaveNotes}
      />
    </div>
  );
}
