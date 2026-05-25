import { useState, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2, CheckCircle, Wrench } from "lucide-react";

interface QuickWorkOrderSheetProps {
  open: boolean;
  onClose: () => void;
  vesselId?: string | undefined;
  defaultEquipmentId?: string | undefined;
}

export function QuickWorkOrderSheet({
  open,
  onClose,
  vesselId,
  defaultEquipmentId,
}: QuickWorkOrderSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [equipmentId, setEquipmentId] = useState(defaultEquipmentId || "");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  interface EquipmentLite {
    id: string;
    name: string;
    equipmentType?: string;
  }
  interface QuickWorkOrderPayload {
    equipmentId: string;
    description: string;
    priority: "low" | "medium" | "high";
    vesselId?: string | undefined;
    photoBase64?: string | undefined;
  }
  interface QuickWorkOrderResponse {
    workOrderNumber?: string;
  }

  const { data: equipmentRaw } = useQuery<EquipmentLite[] | unknown>({
    queryKey: ["/api/equipment", vesselId ? { vesselId } : {}],
    staleTime: 5 * 60 * 1000,
  });
  const equipment: EquipmentLite[] = Array.isArray(equipmentRaw)
    ? (equipmentRaw as EquipmentLite[])
    : [];

  const createMutation = useMutation({
    mutationFn: (data: QuickWorkOrderPayload) =>
      apiRequest<QuickWorkOrderResponse>("POST", "/api/work-orders/quick", data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({
        title: "Work order created",
        description: `${data?.workOrderNumber ?? ""} — ${priority} priority`,
      });
      resetForm();
      onClose();
    },
    onError: (err: unknown) => {
      toast({
        title: "Failed to create work order",
        description:
          (err instanceof Error && err.message) || "Check connectivity and try again",
        variant: "destructive",
      });
    },
  });

  const resetForm = useCallback(() => {
    setEquipmentId(defaultEquipmentId || "");
    setDescription("");
    setPriority("medium");
    setPhotoPreview(null);
    setPhotoBase64(null);
  }, [defaultEquipmentId]);

  const handlePhoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const url = URL.createObjectURL(file);
    setPhotoPreview(url);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1] ?? null;
      setPhotoBase64(base64);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!equipmentId || !description.trim()) {
      return;
    }

    createMutation.mutate({
      equipmentId,
      description: description.trim(),
      priority,
      ...(vesselId !== undefined && { vesselId }),
      ...(photoBase64 && { photoBase64 }),
    });
  }, [equipmentId, description, priority, vesselId, photoBase64, createMutation]);

  const canSubmit = equipmentId && description.trim().length > 0 && !createMutation.isPending;

  const priorityOptions = [
    {
      value: "low" as const,
      label: "Low",
      color: "bg-green-500/10 text-green-600 border-green-500/30",
    },
    {
      value: "medium" as const,
      label: "Med",
      color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
    },
    {
      value: "high" as const,
      label: "High",
      color: "bg-red-500/10 text-red-600 border-red-500/30",
    },
  ];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] rounded-t-2xl"
        data-testid="quick-wo-sheet"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-5 w-5" />
            Quick Work Order
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Equipment</Label>
            <Select value={equipmentId} onValueChange={setEquipmentId}>
              <SelectTrigger className="h-12 text-base" data-testid="quick-wo-equipment">
                <SelectValue placeholder="Select equipment..." />
              </SelectTrigger>
              <SelectContent>
                {equipment.map((eq) => (
                  <SelectItem key={eq.id} value={eq.id}>
                    <span className="flex items-center gap-2">
                      <span>{eq.name}</span>
                      {eq.equipmentType && (
                        <span className="text-xs text-muted-foreground">({eq.equipmentType})</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">What's the problem?</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue..."
              rows={3}
              className="text-base"
              data-testid="quick-wo-description"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Priority</Label>
            <div className="grid grid-cols-3 gap-2">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`h-11 rounded-lg border text-sm font-semibold transition-all ${
                    priority === opt.value
                      ? `${opt.color} ring-1 ring-primary/30`
                      : "border-border text-muted-foreground hover:bg-accent/30"
                  }`}
                  data-testid={`quick-wo-priority-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-muted-foreground">Photo (optional)</Label>
            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Defect photo"
                  className="w-full h-32 object-cover rounded-lg border"
                  data-testid="quick-wo-photo-preview"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoPreview(null);
                    setPhotoBase64(null);
                  }}
                  className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs"
                  data-testid="quick-wo-remove-photo"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-14 rounded-lg border border-dashed border-muted-foreground/30 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:bg-accent/30 transition-colors"
                data-testid="quick-wo-add-photo"
              >
                <Camera className="h-4 w-4" /> Add Photo
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhoto}
              className="hidden"
            />
          </div>
        </div>

        <SheetFooter className="pt-2">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full h-12 text-base font-semibold"
            data-testid="quick-wo-submit"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-5 w-5 mr-2" />
            )}
            Create Work Order
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
