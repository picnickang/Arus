import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Clock, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MaintenanceTemplate } from "@shared/schema";

interface LinkTemplateDialogProps {
  workOrderId: string;
  equipmentType?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

async function fetchTemplates() {
  return apiRequest<MaintenanceTemplate[]>("GET", "/api/maintenance-templates");
}

export function LinkTemplateDialog({
  workOrderId,
  equipmentType,
  open,
  onOpenChange,
  onSuccess,
}: LinkTemplateDialogProps) {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["/api/maintenance-templates"],
    queryFn: fetchTemplates,
    enabled: open,
  });

  const filteredTemplates = equipmentType
    ? templates.filter(
        (t) => t.isActive && t.equipmentType?.toLowerCase() === equipmentType.toLowerCase()
      )
    : templates.filter((t) => t.isActive);

  const linkTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest("POST", `/api/work-orders/${workOrderId}/initialize-checklist`, {
        templateId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance-checklist/${workOrderId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({
        title: "Template Linked",
        description: "Checklist items from the template have been added to this work order",
      });
      onOpenChange(false);
      setSelectedTemplateId("");
      onSuccess?.();
    },
    onError: (_error) => {
      toast({
        title: "Error",
        description: "Failed to link template to work order",
        variant: "destructive",
      });
    },
  });

  const handleLinkTemplate = () => {
    if (selectedTemplateId) {
      linkTemplateMutation.mutate(selectedTemplateId);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="link-template-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Link Maintenance Template
          </DialogTitle>
          <DialogDescription>
            Select a maintenance template to add its checklist items to this work order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoadingTemplates ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {equipmentType
                  ? `No active templates found for ${equipmentType} equipment.`
                  : "No active templates available."}
              </p>
              <p className="text-xs mt-1">Create templates in the Maintenance Templates page.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Template</label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger data-testid="select-link-template">
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTemplates.map((template) => (
                      <SelectItem
                        key={template.id}
                        value={template.id}
                        data-testid={`template-option-${template.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{template.name}</span>
                          {template.priority && template.priority <= 2 && (
                            <Badge variant="outline" className="text-xs">
                              P{template.priority}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <div
                  className="rounded-lg border p-3 bg-muted/30 space-y-2"
                  data-testid="template-preview"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{selectedTemplate.name}</span>
                    {selectedTemplate.estimatedDurationHours && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {selectedTemplate.estimatedDurationHours}h
                      </div>
                    )}
                  </div>
                  {selectedTemplate.description && (
                    <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {selectedTemplate.maintenanceType && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedTemplate.maintenanceType}
                      </Badge>
                    )}
                    {selectedTemplate.equipmentType && (
                      <Badge variant="outline" className="text-xs">
                        {selectedTemplate.equipmentType}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-link-template"
          >
            Cancel
          </Button>
          <Button
            onClick={handleLinkTemplate}
            disabled={!selectedTemplateId || linkTemplateMutation.isPending}
            data-testid="button-confirm-link-template"
          >
            {linkTemplateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Linking...
              </>
            ) : (
              "Link Template"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
