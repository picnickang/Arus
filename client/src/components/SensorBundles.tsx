import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Package, Plus, Edit, Trash2, Lock, Layers } from "lucide-react";
import { useSensorBundlesData, type SensorBundle } from "@/features/telemetry";
import { EQUIPMENT_TYPES } from "@/features/telemetry/hooks/useSensorBundlesData";

export function SensorBundles() {
  const { bundles, isLoading, isCreateOpen, setIsCreateOpen, isEditOpen, setIsEditOpen, editingBundle: _editingBundle, setEditingBundle, deleteBundle, setDeleteBundle, formData, setFormData, templateIdsInput, setTemplateIdsInput, createMutation, updateMutation, deleteMutation: _deleteMutation, resetForm, handleCreate, handleEdit, handleUpdate, handleDelete, systemBundles, customBundles } = useSensorBundlesData();

  if (isLoading) {return (<Card><CardHeader><CardTitle>Sensor Bundles</CardTitle><CardDescription>Loading sensor bundles...</CardDescription></CardHeader></Card>);}

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div><CardTitle>Sensor Bundles</CardTitle><CardDescription>Predefined groups of sensor templates for quick deployment to equipment.</CardDescription></div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild><Button data-testid="button-create-bundle"><Plus className="h-4 w-4 mr-2" />Create Bundle</Button></DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Create Sensor Bundle</DialogTitle><DialogDescription>Create a new sensor bundle to group templates together.</DialogDescription></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="bundleId" className="text-right">Bundle ID*</Label><Input id="bundleId" className="col-span-3" value={formData.bundleId} onChange={(e) => setFormData({ ...formData, bundleId: e.target.value })} placeholder="e.g., MY_CUSTOM_BUNDLE" data-testid="input-bundleId" /></div>
                  <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="name" className="text-right">Name*</Label><Input id="name" className="col-span-3" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., My Custom Bundle" data-testid="input-name" /></div>
                  <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="equipmentType" className="text-right">Equipment Type</Label><Select value={formData.equipmentType} onValueChange={(value) => setFormData({ ...formData, equipmentType: value })}><SelectTrigger className="col-span-3" data-testid="select-equipmentType"><SelectValue placeholder="Select equipment type (optional)" /></SelectTrigger><SelectContent>{EQUIPMENT_TYPES.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select></div>
                  <div className="grid grid-cols-4 items-start gap-4"><Label htmlFor="description" className="text-right pt-2">Description</Label><Textarea id="description" className="col-span-3" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description of this bundle" rows={2} data-testid="input-description" /></div>
                  <div className="grid grid-cols-4 items-start gap-4"><Label htmlFor="templateIds" className="text-right pt-2">Template IDs*</Label><div className="col-span-3 space-y-2"><Input id="templateIds" value={templateIdsInput} onChange={(e) => setTemplateIdsInput(e.target.value)} placeholder="e.g., TEMPLATE-1, TEMPLATE-2, TEMPLATE-3" data-testid="input-templateIds" /><p className="text-xs text-muted-foreground">Enter template IDs separated by commas</p></div></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }} data-testid="button-cancel-create">Cancel</Button><Button onClick={handleCreate} disabled={!formData.bundleId || !formData.name || createMutation.isPending} data-testid="button-submit-create">{createMutation.isPending ? "Creating..." : "Create Bundle"}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {bundles.length === 0 ? (<div className="text-center py-8 text-muted-foreground"><Package className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No sensor bundles available.</p><p className="text-sm mt-2">Create your first bundle to get started.</p></div>) : (
            <div className="space-y-6">
              {systemBundles.length > 0 && (<div><h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Lock className="h-4 w-4" />System Bundles</h3><BundleTable bundles={systemBundles} isSystem={true} /></div>)}
              {customBundles.length > 0 && (<div><h3 className="text-sm font-semibold mb-3">Custom Bundles</h3><BundleTable bundles={customBundles} isSystem={false} onEdit={handleEdit} onDelete={setDeleteBundle} /></div>)}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit Sensor Bundle</DialogTitle><DialogDescription>Update the sensor bundle details.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Bundle ID</Label><Input className="col-span-3" value={formData.bundleId} disabled /></div>
            <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="edit-name" className="text-right">Name*</Label><Input id="edit-name" className="col-span-3" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} data-testid="input-edit-name" /></div>
            <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="edit-equipmentType" className="text-right">Equipment Type</Label><Select value={formData.equipmentType} onValueChange={(value) => setFormData({ ...formData, equipmentType: value })}><SelectTrigger className="col-span-3" data-testid="select-edit-equipmentType"><SelectValue placeholder="Select equipment type (optional)" /></SelectTrigger><SelectContent>{EQUIPMENT_TYPES.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select></div>
            <div className="grid grid-cols-4 items-start gap-4"><Label htmlFor="edit-description" className="text-right pt-2">Description</Label><Textarea id="edit-description" className="col-span-3" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} data-testid="input-edit-description" /></div>
            <div className="grid grid-cols-4 items-start gap-4"><Label htmlFor="edit-templateIds" className="text-right pt-2">Template IDs*</Label><div className="col-span-3 space-y-2"><Input id="edit-templateIds" value={templateIdsInput} onChange={(e) => setTemplateIdsInput(e.target.value)} data-testid="input-edit-templateIds" /><p className="text-xs text-muted-foreground">Enter template IDs separated by commas</p></div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { setIsEditOpen(false); setEditingBundle(null); resetForm(); }} data-testid="button-cancel-edit">Cancel</Button><Button onClick={handleUpdate} disabled={!formData.name || updateMutation.isPending} data-testid="button-submit-edit">{updateMutation.isPending ? "Updating..." : "Update Bundle"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteBundle} onOpenChange={(open) => !open && setDeleteBundle(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Bundle</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete bundle "{deleteBundle?.name}"? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" data-testid="button-confirm-delete">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BundleTable({ bundles, isSystem, onEdit, onDelete }: { bundles: SensorBundle[]; isSystem: boolean; onEdit?: (bundle: SensorBundle) => void; onDelete?: (bundle: SensorBundle) => void }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Bundle ID</TableHead><TableHead>Name</TableHead><TableHead>Equipment Type</TableHead><TableHead>Templates</TableHead><TableHead>Description</TableHead>{!isSystem && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
      <TableBody>
        {bundles.map((bundle) => (
          <TableRow key={bundle.id}>
            <TableCell className="font-medium font-mono text-sm">{bundle.bundleId}</TableCell>
            <TableCell>{bundle.name}</TableCell>
            <TableCell>{bundle.equipmentType ? <Badge variant="outline">{bundle.equipmentType}</Badge> : "-"}</TableCell>
            <TableCell><Badge variant="secondary"><Layers className="h-3 w-3 mr-1" />{bundle.templateIds.length} templates</Badge></TableCell>
            <TableCell className="max-w-xs truncate text-sm">{bundle.description || "-"}</TableCell>
            {!isSystem && (<TableCell className="text-right"><div className="flex gap-2 justify-end"><Button size="sm" variant="outline" onClick={() => onEdit?.(bundle)} data-testid={`button-edit-${bundle.bundleId}`}><Edit className="h-4 w-4" /></Button><Button size="sm" variant="destructive" onClick={() => onDelete?.(bundle)} data-testid={`button-delete-${bundle.bundleId}`}><Trash2 className="h-4 w-4" /></Button></div></TableCell>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
