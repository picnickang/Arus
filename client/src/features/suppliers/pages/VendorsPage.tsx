import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Building2, Wrench } from "lucide-react";
import { useSuppliersWithStats, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from "../hooks/useSuppliers";
import { SupplierCard } from "../components/SupplierCard";
import { SupplierForm } from "../components/SupplierForm";
import type { SupplierWithStats, SupplierFormData, VendorType } from "../types";

export function VendorsPage() {
  const [activeTab, setActiveTab] = useState<"suppliers" | "service_providers">("suppliers");
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formDefaultType, setFormDefaultType] = useState<VendorType>("supplier");
  const [editingSupplier, setEditingSupplier] = useState<SupplierWithStats | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<SupplierWithStats | null>(null);

  const { toast } = useToast();
  const { data: allVendors, isLoading, error } = useSuppliersWithStats();
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();

  const { suppliers, serviceProviders } = useMemo(() => {
    if (!allVendors) return { suppliers: [], serviceProviders: [] };
    
    const searchLower = search.toLowerCase();
    const filtered = allVendors.filter((v) =>
      v.name.toLowerCase().includes(searchLower) ||
      v.code.toLowerCase().includes(searchLower) ||
      v.contactName?.toLowerCase().includes(searchLower)
    );

    return {
      suppliers: filtered.filter((v) => v.type === "supplier" || v.type === "both"),
      serviceProviders: filtered.filter((v) => v.type === "service_provider" || v.type === "both"),
    };
  }, [allVendors, search]);

  const handleOpenForm = (type: VendorType) => {
    setFormDefaultType(type);
    setIsFormOpen(true);
  };

  const handleCreate = (data: SupplierFormData) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        toast({ title: `${data.type === "service_provider" ? "Service provider" : "Supplier"} created successfully` });
        setIsFormOpen(false);
      },
      onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
    });
  };

  const handleUpdate = (data: SupplierFormData) => {
    if (!editingSupplier) return;
    updateMutation.mutate({ id: editingSupplier.id, ...data }, {
      onSuccess: () => {
        toast({ title: "Vendor updated successfully" });
        setEditingSupplier(null);
      },
      onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
    });
  };

  const handleDelete = () => {
    if (!deletingSupplier) return;
    deleteMutation.mutate(deletingSupplier.id, {
      onSuccess: () => {
        toast({ title: "Vendor deleted successfully" });
        setDeletingSupplier(null);
      },
      onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
    });
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load vendors: {String(error)}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderVendorGrid = (vendors: SupplierWithStats[], emptyIcon: typeof Building2, emptyLabel: string, addType: VendorType) => (
    isLoading ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendors.map((vendor) => (
          <SupplierCard key={vendor.id} supplier={vendor} onEdit={setEditingSupplier} onDelete={setDeletingSupplier} />
        ))}
        {vendors.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              {emptyIcon === Building2 ? <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" /> : <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />}
              <p className="text-muted-foreground">No {emptyLabel} found</p>
              <Button variant="outline" className="mt-4" onClick={() => handleOpenForm(addType)}>Add your first {emptyLabel.slice(0, -1)}</Button>
            </CardContent>
          </Card>
        )}
      </div>
    )
  );

  return (
    <div className="p-6 space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="suppliers" data-testid="tab-suppliers">
              <Building2 className="h-4 w-4 mr-2" />
              Suppliers ({suppliers.length})
            </TabsTrigger>
            <TabsTrigger value="service_providers" data-testid="tab-service-providers">
              <Wrench className="h-4 w-4 mr-2" />
              Service Providers ({serviceProviders.length})
            </TabsTrigger>
          </TabsList>
          <Button onClick={() => handleOpenForm(activeTab === "service_providers" ? "service_provider" : "supplier")} data-testid="button-add-vendor">
            <Plus className="h-4 w-4 mr-2" />
            Add {activeTab === "service_providers" ? "Service Provider" : "Supplier"}
          </Button>
        </div>

        <div className="flex items-center gap-4 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search vendors..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" data-testid="input-search" />
          </div>
        </div>

        <TabsContent value="suppliers" className="mt-4">
          {renderVendorGrid(suppliers, Building2, "suppliers", "supplier")}
        </TabsContent>

        <TabsContent value="service_providers" className="mt-4">
          {renderVendorGrid(serviceProviders, Wrench, "service providers", "service_provider")}
        </TabsContent>
      </Tabs>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add New {formDefaultType === "service_provider" ? "Service Provider" : "Supplier"}</DialogTitle></DialogHeader>
          <SupplierForm defaultType={formDefaultType} onSubmit={handleCreate} onCancel={() => setIsFormOpen(false)} isPending={createMutation.isPending} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingSupplier} onOpenChange={() => setEditingSupplier(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit {editingSupplier?.type === "service_provider" ? "Service Provider" : "Vendor"}</DialogTitle></DialogHeader>
          {editingSupplier && (
            <SupplierForm supplier={editingSupplier} onSubmit={handleUpdate} onCancel={() => setEditingSupplier(null)} isPending={updateMutation.isPending} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingSupplier} onOpenChange={() => setDeletingSupplier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingSupplier?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
