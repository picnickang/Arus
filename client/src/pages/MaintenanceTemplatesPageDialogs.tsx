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
import { Button } from "@/components/ui/button";
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
import {
  EQUIPMENT_TYPES,
  FREQUENCY_OPTIONS,
  PRIORITY_OPTIONS_TEMPLATE,
} from "@/features/maintenance";
import {
  ChecklistSection,
  type TemplateItem,
  ViewTemplateContent,
} from "./MaintenanceTemplatesPageCards";
import type { MaintenanceTemplatesPageModel } from "./MaintenanceTemplatesPageTypes";

interface MaintenanceTemplateDialogsProps {
  m: MaintenanceTemplatesPageModel;
}

export function MaintenanceTemplateDialogs({ m }: MaintenanceTemplateDialogsProps) {
  return (
    <>
      <Dialog
        open={m.isCreateDialogOpen || m.isEditDialogOpen}
        onOpenChange={(open) => !open && m.closeDialog()}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title">
              {m.isEditDialogOpen ? "Edit Template" : "Create Template"}
            </DialogTitle>
            <DialogDescription>
              {m.isEditDialogOpen
                ? "Update the template details below"
                : "Create a new maintenance template with checklist items"}
            </DialogDescription>
          </DialogHeader>
          <Form {...m.templateForm}>
            <form onSubmit={m.templateForm.handleSubmit(m.onTemplateSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={m.templateForm.control}
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
                  control={m.templateForm.control}
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
                control={m.templateForm.control}
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
                  control={m.templateForm.control}
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
                  control={m.templateForm.control}
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
                  control={m.templateForm.control}
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
              {!m.isEditDialogOpen && (
                <ChecklistSection
                  checklistItems={m.checklistItems}
                  editingItemIndex={m.editingItemIndex}
                  itemForm={m.itemForm}
                  onAdd={m.addChecklistItem}
                  onEdit={m.editChecklistItem}
                  onRemove={m.removeChecklistItem}
                />
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={m.closeDialog}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    m.createTemplateMutation.isPending || m.updateTemplateMutation.isPending
                  }
                  data-testid="button-submit"
                >
                  {m.createTemplateMutation.isPending || m.updateTemplateMutation.isPending
                    ? "Saving..."
                    : m.isEditDialogOpen
                      ? "Update Template"
                      : "Create Template"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={m.isViewDialogOpen} onOpenChange={m.setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle data-testid="view-dialog-title">{m.selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              {m.selectedTemplate?.description || "No description"}
            </DialogDescription>
          </DialogHeader>
          {m.selectedTemplate && (
            <ViewTemplateContent
              template={m.selectedTemplate}
              items={m.templateItems as TemplateItem[]}
              onClose={() => m.setIsViewDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!m.deleteTemplateId}
        onOpenChange={(open) => !open && m.setDeleteTemplateId(null)}
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
              onClick={m.confirmDelete}
              disabled={m.deleteTemplateMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {m.deleteTemplateMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
