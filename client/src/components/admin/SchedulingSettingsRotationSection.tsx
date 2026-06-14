import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Plus, Star, Trash2 } from "lucide-react";
import { useSchedulingSettingsData } from "@/features/settings/hooks/useSchedulingSettingsData";

export function RotationTemplatesSection() {
  const {
    settings,
    handleAddTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    handleSetDefaultTemplate,
    updateRotationTemplatesMutation,
  } = useSchedulingSettingsData();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", onDays: 28, offDays: 28 });
  const isSaving = updateRotationTemplatesMutation.isPending;

  const handleAdd = () => {
    if (newTemplate.name.trim()) {
      handleAddTemplate({ ...newTemplate, isDefault: false });
      setNewTemplate({ name: "", onDays: 28, offDays: 28 });
      setIsAddingNew(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Rotation Templates
        </CardTitle>
        <CardDescription>Define crew rotation patterns (on/off cycles)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {settings.rotationTemplates.map((template) => (
          <div
            key={template.id}
            className="flex items-center justify-between gap-4 p-3 border rounded-lg"
          >
            <div className="flex items-center gap-3">
              {template.isDefault && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
              <div>
                <div className="font-medium">{template.name}</div>
                <div className="text-sm text-muted-foreground">
                  {template.onDays} days on / {template.offDays} days off
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!template.isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSetDefaultTemplate(template.id)}
                  disabled={isSaving}
                  data-testid={`button-set-default-${template.id}`}
                >
                  <Star className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteTemplate(template.id)}
                disabled={isSaving || settings.rotationTemplates.length <= 1}
                data-testid={`button-delete-template-${template.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {isAddingNew ? (
          <div className="p-3 border rounded-lg space-y-3">
            <Input
              placeholder="Template name (e.g., 42/21)"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              data-testid="input-template-name"
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs">On Days</Label>
                <Input
                  type="number"
                  value={newTemplate.onDays}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, onDays: Number(e.target.value) })
                  }
                  min={1}
                  max={120}
                  data-testid="input-template-onDays"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">Off Days</Label>
                <Input
                  type="number"
                  value={newTemplate.offDays}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, offDays: Number(e.target.value) })
                  }
                  min={1}
                  max={120}
                  data-testid="input-template-offDays"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!newTemplate.name.trim() || isSaving}
                data-testid="button-save-template"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddingNew(false)}
                data-testid="button-cancel-template"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setIsAddingNew(true)}
            data-testid="button-add-template"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Template
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
