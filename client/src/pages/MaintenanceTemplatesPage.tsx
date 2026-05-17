import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Copy, FileText, CheckSquare, Clock } from "lucide-react";
import {
  useMaintenanceTemplatesData,
  getPriorityBadgeConfig,
  EQUIPMENT_TYPES,
  FREQUENCY_OPTIONS,
  PRIORITY_OPTIONS_TEMPLATE,
} from "@/features/maintenance";

export default function MaintenanceTemplatesPage() {
  const {
    selectedType,
    setSelectedType,
    selectedTemplate,
    isCreateDialogOpen,
    isEditDialogOpen,
    isViewDialogOpen,
    setIsViewDialogOpen,
    deleteTemplateId,
    setDeleteTemplateId,
    checklistItems,
    editingItemIndex,
    filteredTemplates,
    templateItems,
    isLoading,
    templateForm,
    itemForm,
    createTemplateMutation,
    updateTemplateMutation,
    deleteTemplateMutation,
    cloneTemplateMutation,
    onTemplateSubmit,
    handleEdit,
    handleView,
    handleDelete,
    handleClone,
    addChecklistItem,
    editChecklistItem,
    removeChecklistItem,
    openCreateDialog,
    openCreateForType,
    closeDialog,
    confirmDelete,
  } = useMaintenanceTemplatesData();

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="maintenance-templates-page">
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-end items-center">
          <Button onClick={openCreateDialog} data-testid="button-create-template">
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>

        <Tabs
          value={selectedType}
          onValueChange={setSelectedType}
          data-testid="equipment-type-tabs"
        >
          <div className="overflow-x-auto pb-2">
            <TabsList className="inline-flex w-full min-w-fit p-1 gap-1">
              {EQUIPMENT_TYPES.map((type) => (
                <TabsTrigger
                  key={type.value}
                  value={type.value}
                  data-testid={`tab-${type.value}`}
                  className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[80px] sm:min-w-[100px] transition-all"
                >
                  <span>{type.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {EQUIPMENT_TYPES.map((type) => (
            <TabsContent key={type.value} value={type.value} className="space-y-4">
              {filteredTemplates.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onView={handleView as any}
                      onEdit={handleEdit as any}
                      onClone={handleClone}
                      onDelete={handleDelete}
                      cloneIsPending={cloneTemplateMutation.isPending}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3
                      className="text-lg font-semibold mb-2"
                      data-testid={`no-templates-${type.value}`}
                    >
                      No templates for {type.label}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Create your first maintenance template for this equipment type
                    </p>
                    <Button
                      onClick={() => openCreateForType(type.value)}
                      data-testid={`button-create-first-${type.value}`}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Template
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <Dialog
          open={isCreateDialogOpen || isEditDialogOpen}
          onOpenChange={(open) => !open && closeDialog()}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="dialog-title">
                {isEditDialogOpen ? "Edit Template" : "Create Template"}
              </DialogTitle>
              <DialogDescription>
                {isEditDialogOpen
                  ? "Update the template details below"
                  : "Create a new maintenance template with checklist items"}
              </DialogDescription>
            </DialogHeader>
            <Form {...templateForm}>
              <form onSubmit={templateForm.handleSubmit(onTemplateSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={templateForm.control}
                    name="equipmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipment Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-equipment-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EQUIPMENT_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={templateForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Annual engine inspection"
                            {...field}
                            data-testid="input-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={templateForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Comprehensive inspection of main engine..."
                          {...field}
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={templateForm.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-frequency">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FREQUENCY_OPTIONS.map((freq) => (
                              <SelectItem key={freq.value} value={freq.value}>
                                {freq.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={templateForm.control}
                    name="estimatedDuration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (minutes) *</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-duration" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={templateForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-priority">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PRIORITY_OPTIONS_TEMPLATE.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {!isEditDialogOpen && (
                  <ChecklistSection
                    checklistItems={checklistItems}
                    editingItemIndex={editingItemIndex}
                    itemForm={itemForm as any}
                    onAdd={addChecklistItem as any}
                    onEdit={editChecklistItem}
                    onRemove={removeChecklistItem}
                  />
                )}
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeDialog}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createTemplateMutation.isPending || updateTemplateMutation.isPending
                      ? "Saving..."
                      : isEditDialogOpen
                        ? "Update Template"
                        : "Create Template"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle data-testid="view-dialog-title">{selectedTemplate?.name}</DialogTitle>
              <DialogDescription>
                {selectedTemplate?.description || "No description"}
              </DialogDescription>
            </DialogHeader>
            {selectedTemplate && (
              <ViewTemplateContent
                template={selectedTemplate}
                items={templateItems as any}
                onClose={() => setIsViewDialogOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={!!deleteTemplateId}
          onOpenChange={(open) => !open && setDeleteTemplateId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle data-testid="delete-dialog-title">Delete Template</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this maintenance template? This will also delete all
                associated checklist items. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={deleteTemplateMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteTemplateMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

interface MaintenanceTemplate {
  id: string;
  name: string;
  description?: string | null;
  priority: string;
  frequency: string;
  estimatedDuration: number;
  equipmentType: string;
}
interface ChecklistItemData {
  stepNumber: number;
  description: string;
  required?: boolean;
  estimatedMinutes?: number;
}
function TemplateCard({
  template,
  onView,
  onEdit,
  onClone,
  onDelete,
  cloneIsPending,
}: {
  template: MaintenanceTemplate;
  onView: (t: MaintenanceTemplate) => void;
  onEdit: (t: MaintenanceTemplate) => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
  cloneIsPending: boolean;
}) {
  const config = getPriorityBadgeConfig(template.priority);
  return (
    <Card data-testid={`template-card-${template.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg" data-testid={`template-name-${template.id}`}>
              {template.name}
            </CardTitle>
            <CardDescription className="mt-2" data-testid={`template-desc-${template.id}`}>
              {template.description || "No description"}
            </CardDescription>
          </div>
          <Badge variant={config.variant} className={config.className}>
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Frequency:</span>
            <span className="font-medium" data-testid={`template-freq-${template.id}`}>
              {template.frequency}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Duration:</span>
            <span className="font-medium" data-testid={`template-duration-${template.id}`}>
              {template.estimatedDuration} min
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onView(template)}
            data-testid={`button-view-${template.id}`}
          >
            <FileText className="h-3 w-3 mr-1" />
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(template)}
            data-testid={`button-edit-${template.id}`}
          >
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onClone(template.id)}
            disabled={cloneIsPending}
            data-testid={`button-clone-${template.id}`}
          >
            <Copy className="h-3 w-3 mr-1" />
            Clone
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onDelete(template.id)}
            data-testid={`button-delete-${template.id}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChecklistSection({
  checklistItems,
  editingItemIndex,
  itemForm,
  onAdd,
  onEdit,
  onRemove,
}: {
  checklistItems: ChecklistItemData[];
  editingItemIndex: number | null;
  itemForm: ReturnType<typeof import("react-hook-form").useForm>;
  onAdd: (data: ChecklistItemData) => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="border-t pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Checklist Items</h3>
        <Badge variant="secondary" data-testid="badge-item-count">
          {checklistItems.length} items
        </Badge>
      </div>
      {checklistItems.length > 0 && (
        <div className="space-y-2">
          {checklistItems.map((item, index) => (
            <div
              key={`item-${item.stepNumber}-${item.description.slice(0, 20)}`}
              className="flex items-start justify-between p-3 border rounded"
              data-testid={`checklist-item-${index}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" data-testid={`item-step-${index}`}>
                    Step {item.stepNumber}
                  </Badge>
                  {item.required && (
                    <Badge variant="destructive" data-testid={`item-required-${index}`}>
                      Required
                    </Badge>
                  )}
                </div>
                <p className="text-sm mt-2" data-testid={`item-description-${index}`}>
                  {item.description}
                </p>
                {item.estimatedMinutes && (
                  <p
                    className="text-xs text-muted-foreground mt-1"
                    data-testid={`item-minutes-${index}`}
                  >
                    Est. {item.estimatedMinutes} minutes
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(index)}
                  data-testid={`button-edit-item-${index}`}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(index)}
                  data-testid={`button-remove-item-${index}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="font-medium">Add Checklist Item</h4>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={itemForm.control as any}
            name="stepNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Step Number</FormLabel>
                <FormControl>
                  <Input type="number" {...field} data-testid="input-step-number" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={itemForm.control as any}
            name="estimatedMinutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Est. Minutes</FormLabel>
                <FormControl>
                  <Input type="number" {...field} data-testid="input-item-minutes" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={itemForm.control as any}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Check oil level..."
                  {...field}
                  data-testid="textarea-item-description"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={itemForm.control as any}
          name="required"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  data-testid="checkbox-required"
                />
              </FormControl>
              <FormLabel className="!mt-0">Required step</FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={itemForm.handleSubmit(onAdd as any)}
          data-testid="button-add-item"
        >
          <Plus className="h-4 w-4 mr-2" />
          {editingItemIndex === null ? "Add Item" : "Update Item"}
        </Button>
      </div>
    </div>
  );
}

interface TemplateItem {
  id: string;
  stepNumber: number;
  description: string;
  required?: boolean;
  estimatedMinutes?: number;
}
function ViewTemplateContent({
  template,
  items,
  onClose,
}: {
  template: MaintenanceTemplate;
  items: TemplateItem[];
  onClose: () => void;
}) {
  const config = getPriorityBadgeConfig(template.priority);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Equipment Type</label>
          <p className="text-sm" data-testid="view-equipment-type">
            {EQUIPMENT_TYPES.find((t) => t.value === template.equipmentType)?.label}
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Frequency</label>
          <p className="text-sm" data-testid="view-frequency">
            {template.frequency}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Duration</label>
          <p className="text-sm" data-testid="view-duration">
            {template.estimatedDuration} minutes
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Priority</label>
          <div className="mt-1">
            <Badge variant={config.variant} className={config.className}>
              {config.label}
            </Badge>
          </div>
        </div>
      </div>
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <CheckSquare className="h-5 w-5" />
          Checklist Items
        </h3>
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="p-3 border rounded flex items-start gap-3"
                data-testid={`view-item-${index}`}
              >
                <Badge variant="outline" data-testid={`view-item-step-${index}`}>
                  {item.stepNumber}
                </Badge>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {item.required && (
                      <Badge variant="destructive" data-testid={`view-item-required-${index}`}>
                        Required
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm" data-testid={`view-item-desc-${index}`}>
                    {item.description}
                  </p>
                  {item.estimatedMinutes && (
                    <p
                      className="text-xs text-muted-foreground mt-1"
                      data-testid={`view-item-minutes-${index}`}
                    >
                      Est. {item.estimatedMinutes} minutes
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 border rounded">
            <CheckSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm" data-testid="view-no-items">
              No checklist items defined
            </p>
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button onClick={onClose} data-testid="button-close-view">
          Close
        </Button>
      </div>
    </div>
  );
}
