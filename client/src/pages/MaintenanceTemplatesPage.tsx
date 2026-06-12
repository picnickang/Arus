import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Plus } from "lucide-react";
import { EQUIPMENT_TYPES, useMaintenanceTemplatesData } from "@/features/maintenance";
import { TemplateCard } from "./MaintenanceTemplatesPageCards";
import { MaintenanceTemplateDialogs } from "./MaintenanceTemplatesPageDialogs";

export default function MaintenanceTemplatesPage() {
  const m = useMaintenanceTemplatesData();

  if (m.isLoading) {
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
          <Button onClick={m.openCreateDialog} data-testid="button-create-template">
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>

        <Tabs
          value={m.selectedType}
          onValueChange={m.setSelectedType}
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
              {m.filteredTemplates.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {m.filteredTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onView={m.handleView}
                      onEdit={m.handleEdit}
                      onClone={m.handleClone}
                      onDelete={m.handleDelete}
                      cloneIsPending={m.cloneTemplateMutation.isPending}
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
                      onClick={() => m.openCreateForType(type.value)}
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

        <MaintenanceTemplateDialogs m={m} />
      </div>
    </div>
  );
}
