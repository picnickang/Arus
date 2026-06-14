import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckSquare, Clock, Copy, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { EQUIPMENT_TYPES, getPriorityBadgeConfig } from "@/features/maintenance";
import type { ChecklistItemFormData } from "@/features/maintenance/lib/templateUtils";
import type { UseFormReturn } from "react-hook-form";

export interface MaintenanceTemplateCardModel {
  id: string;
  name: string;
  description?: string;
  priority: string;
  frequency: string;
  estimatedDuration: number;
  equipmentType: string;
}

type ChecklistItemData = ChecklistItemFormData;

export interface TemplateItem {
  id: string;
  stepNumber: number;
  description: string;
  required?: boolean;
  estimatedMinutes?: number;
}

export function TemplateCard({
  template,
  onView,
  onEdit,
  onClone,
  onDelete,
  cloneIsPending,
}: {
  template: MaintenanceTemplateCardModel;
  onView: (t: MaintenanceTemplateCardModel) => void;
  onEdit: (t: MaintenanceTemplateCardModel) => void;
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

export function ChecklistSection({
  checklistItems,
  editingItemIndex,
  itemForm,
  onAdd,
  onEdit,
  onRemove,
}: {
  checklistItems: ChecklistItemData[];
  editingItemIndex: number | null;
  itemForm: UseFormReturn<ChecklistItemFormData>;
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
            control={itemForm.control}
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
            control={itemForm.control}
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
          control={itemForm.control}
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
          control={itemForm.control}
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
          onClick={itemForm.handleSubmit(onAdd)}
          data-testid="button-add-item"
        >
          <Plus className="h-4 w-4 mr-2" />
          {editingItemIndex === null ? "Add Item" : "Update Item"}
        </Button>
      </div>
    </div>
  );
}

export function ViewTemplateContent({
  template,
  items,
  onClose,
}: {
  template: MaintenanceTemplateCardModel;
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
