/** Upload / replace dialog family for the diagram registry (replacement
 * behavior selection plus copy-from-vessel / copy-from-template pickers).
 * Extracted verbatim from the pre-split registry-screens.tsx. */

import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { type RegistryDiagramRecord, type RegistrySectionMapRecord } from "../data";
import {
  type ReplacementBehavior,
  useSectionMaps,
  useSectionMapTemplates,
  useUploadDiagramVersion,
} from "../registry-api";

export function DiagramUploadReplaceDialog({
  vesselId,
  diagram,
  open,
  onOpenChange,
}: {
  vesselId: string;
  diagram: RegistryDiagramRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [behavior, setBehavior] = useState<ReplacementBehavior>("keep_existing");
  const [sourceVesselId, setSourceVesselId] = useState("");
  const [sourceMapId, setSourceMapId] = useState("");
  const [templateId, setTemplateId] = useState("osv_workboat");
  const [mapName, setMapName] = useState("");
  const upload = useUploadDiagramVersion();
  const templatesQuery = useSectionMapTemplates();
  const mapsQuery = useSectionMaps(vesselId);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const submit = async () => {
    if (!file) {
      toast({
        title: "File rejected",
        description: "Choose a diagram file before uploading.",
        variant: "destructive",
      });
      return;
    }
    const result = await upload.mutateAsync({
      vesselId,
      diagramId: diagram.id,
      file,
      replacementBehavior: behavior,
      sourceVesselId: behavior === "copy_vessel" ? sourceVesselId : undefined,
      sourceMapId: behavior === "copy_vessel" ? sourceMapId : undefined,
      templateId: behavior === "copy_template" ? templateId : undefined,
      mapName: mapName || undefined,
    });
    const draftMap = result.draftMap;
    onOpenChange(false);
    if (draftMap?.id) {
      setLocation(`/vessel-intelligence/${vesselId}/section-maps/${draftMap.id}/edit`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-upload-replace-diagram">
        <DialogHeader>
          <DialogTitle>Upload / Replace Diagram</DialogTitle>
          <DialogDescription>{diagram.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="diagram-upload-file">Diagram file</Label>
            <Input
              id="diagram-upload-file"
              type="file"
              accept="image/svg+xml,image/png,image/jpeg,image/webp"
              onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="diagram-map-name">Draft map name</Label>
            <Input
              id="diagram-map-name"
              value={mapName}
              onChange={(event) => setMapName(event.target.value)}
              placeholder={`${diagram.title} draft map`}
            />
          </div>
          <ReplacementBehaviorSelector value={behavior} onChange={setBehavior} />
          {behavior === "copy_vessel" && (
            <CopyFromVesselDialog
              maps={mapsQuery.data ?? []}
              sourceVesselId={sourceVesselId}
              sourceMapId={sourceMapId}
              onSourceVesselIdChange={setSourceVesselId}
              onSourceMapIdChange={setSourceMapId}
            />
          )}
          {behavior === "copy_template" && (
            <CopyFromTemplateDialog
              templates={templatesQuery.data ?? []}
              templateId={templateId}
              onTemplateIdChange={setTemplateId}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-testid="button-submit-upload-replace"
            onClick={() => void submit()}
            disabled={
              upload.isPending ||
              !file ||
              (behavior === "copy_vessel" && (!sourceVesselId || !sourceMapId))
            }
          >
            {upload.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReplacementBehaviorSelector({
  value,
  onChange,
}: {
  value: ReplacementBehavior;
  onChange: (value: ReplacementBehavior) => void;
}) {
  const options: Array<{
    value: ReplacementBehavior;
    label: string;
    description: string;
    testId: string;
  }> = [
    {
      value: "keep_existing",
      label: "Keep existing section map as draft overlay",
      description: "Clone the current map as a draft over the new schematic.",
      testId: "replacement-option-keep-existing",
    },
    {
      value: "start_blank",
      label: "Start blank section map",
      description: "Create an empty draft map for fresh sections.",
      testId: "replacement-option-start-blank",
    },
    {
      value: "copy_vessel",
      label: "Copy section map from another vessel",
      description: "Clone a source map without blindly copying equipment assignments.",
      testId: "replacement-option-copy-vessel",
    },
    {
      value: "copy_template",
      label: "Copy section map from vessel type template",
      description: "Use a backend template as the draft map starter.",
      testId: "replacement-option-copy-template",
    },
  ];
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(next as ReplacementBehavior)}
      className="grid gap-2"
    >
      {options.map((option) => (
        <label
          key={option.value}
          htmlFor={option.value}
          className="flex cursor-pointer gap-3 rounded-md border p-3 text-sm"
          data-testid={option.testId}
        >
          <RadioGroupItem id={option.value} value={option.value} />
          <span>
            <span className="block font-medium">{option.label}</span>
            <span className="block text-muted-foreground">{option.description}</span>
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}

export function CopyFromVesselDialog({
  maps,
  sourceVesselId,
  sourceMapId,
  onSourceVesselIdChange,
  onSourceMapIdChange,
}: {
  maps: RegistrySectionMapRecord[];
  sourceVesselId: string;
  sourceMapId: string;
  onSourceVesselIdChange: (value: string) => void;
  onSourceMapIdChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="source-vessel-id">Source vessel ID</Label>
        <Input
          id="source-vessel-id"
          value={sourceVesselId}
          onChange={(event) => onSourceVesselIdChange(event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label>Source map</Label>
        <Select value={sourceMapId} onValueChange={onSourceMapIdChange}>
          <SelectTrigger>
            <SelectValue placeholder="Choose source map" />
          </SelectTrigger>
          <SelectContent>
            {maps.map((map) => (
              <SelectItem key={map.id} value={map.id}>
                {map.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function CopyFromTemplateDialog({
  templates,
  templateId,
  onTemplateIdChange,
}: {
  templates: Array<{ id: string; name: string; description: string }>;
  templateId: string;
  onTemplateIdChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 rounded-md border p-3">
      <Label>Vessel type template</Label>
      <Select value={templateId} onValueChange={onTemplateIdChange}>
        <SelectTrigger>
          <SelectValue placeholder="Choose template" />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {templates.find((template) => template.id === templateId)?.description ??
          "Template registry loading."}
      </p>
    </div>
  );
}
