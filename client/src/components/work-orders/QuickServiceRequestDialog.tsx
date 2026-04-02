/**
 * Quick Service Request Dialog
 *
 * UX FIX #5: Simplified 4-field service request form for common cases.
 * Provider + Equipment + Description + Date — that's it.
 *
 * Shows "Advanced options" toggle to expand to the full
 * EnhancedServiceRequestDialog fields (MOC, certificates, etc.).
 *
 * Usage:
 *   <QuickServiceRequestDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     onSubmit={handleCreateServiceOrder}
 *     isPending={isCreating}
 *     workOrderId="wo-123"
 *   />
 */

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Loader2, Wrench, ChevronDown, ChevronUp, Star, Clock } from "lucide-react";

interface QuickServiceRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
  workOrderId?: string;
}

export function QuickServiceRequestDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  workOrderId,
}: QuickServiceRequestDialogProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Quick fields (always visible)
  const [providerId, setProviderId] = useState("");
  const [scope, setScope] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");

  // Advanced fields (toggled)
  const [severity, setSeverity] = useState("general");
  const [quotedAmount, setQuotedAmount] = useState("");
  const [specialRequirements, setSpecialRequirements] = useState("");
  const [mocRequired, setMocRequired] = useState(false);
  const [mocNumber, setMocNumber] = useState("");

  const { data: providers } = useQuery<{
    id: string;
    name: string;
    qualityRating?: number;
    responseSlaHours?: number;
    isPreferred?: boolean;
  }[]>({
    queryKey: ["/api/suppliers?type=service_provider,both"],
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setProviderId("");
      setScope("");
      setScheduledDate("");
      setEstimatedHours("");
      setSeverity("general");
      setQuotedAmount("");
      setSpecialRequirements("");
      setMocRequired(false);
      setMocNumber("");
      setShowAdvanced(false);
    }
  }, [open]);

  const handleSubmit = () => {
    const data: Record<string, unknown> = {
      serviceProviderId: providerId,
      scope: scope.trim(),
      scheduledStartDate: scheduledDate ? new Date(scheduledDate) : undefined,
      estimatedDurationHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
      symptomDescription: scope.trim(),
      equipmentIds: [],
      assistanceTags: [],
      isRecurringDefect: false,
    };

    if (showAdvanced) {
      data.severity = severity;
      data.quotedAmount = quotedAmount ? parseFloat(quotedAmount) : undefined;
      data.specialRequirements = specialRequirements.trim() || undefined;
      data.mocRequired = mocRequired;
      data.mocNumber = mocRequired ? mocNumber || undefined : undefined;
    }

    onSubmit(data);
  };

  const canSubmit = providerId && scope.trim() && !isPending;

  // Sort providers: preferred first, then by quality rating
  const sortedProviders = [...(providers || [])].sort((a, b) => {
    if (a.isPreferred && !b.isPreferred) return -1;
    if (!a.isPreferred && b.isPreferred) return 1;
    return (b.qualityRating ?? 0) - (a.qualityRating ?? 0);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Request Service
          </DialogTitle>
          <DialogDescription>
            Quick service request — fill in the basics, or expand for full details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Provider selection with performance badges */}
          <div>
            <Label>Service Provider *</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger data-testid="select-quick-provider">
                <SelectValue placeholder="Select provider..." />
              </SelectTrigger>
              <SelectContent>
                {sortedProviders.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span className="truncate">{p.name}</span>
                      {p.isPreferred && (
                        <Star className="h-3 w-3 text-amber-500 flex-shrink-0" />
                      )}
                      {p.qualityRating != null && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          ★{p.qualityRating.toFixed(1)}
                        </span>
                      )}
                      {p.responseSlaHours != null && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
                          <Clock className="h-2.5 w-2.5" />
                          {p.responseSlaHours}h
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scope */}
          <div>
            <Label>What do you need? *</Label>
            <Textarea
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Describe the work needed..."
              rows={3}
              data-testid="input-quick-scope"
            />
          </div>

          {/* Date and duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>When?</Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                data-testid="input-quick-date"
              />
            </div>
            <div>
              <Label>How long? (hours)</Label>
              <Input
                type="number"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="e.g., 8"
                data-testid="input-quick-hours"
              />
            </div>
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
            data-testid="btn-toggle-advanced"
          >
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {showAdvanced ? "Hide advanced options" : "Show advanced options"}
          </button>

          {/* Advanced fields */}
          {showAdvanced && (
            <>
              <Separator />
              <div className="space-y-4">
                {/* Severity */}
                <div>
                  <Label>Severity</Label>
                  <div className="flex gap-2 mt-1">
                    {[
                      { value: "general", label: "General", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
                      { value: "safety", label: "Safety", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
                      { value: "critical", label: "Critical", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
                    ].map((opt) => (
                      <Badge
                        key={opt.value}
                        className={`cursor-pointer px-3 py-1 ${
                          severity === opt.value ? opt.color : "bg-muted text-muted-foreground"
                        }`}
                        onClick={() => setSeverity(opt.value)}
                        data-testid={`badge-severity-${opt.value}`}
                      >
                        {opt.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Quoted amount */}
                <div>
                  <Label>Quoted Amount ($)</Label>
                  <Input
                    type="number"
                    value={quotedAmount}
                    onChange={(e) => setQuotedAmount(e.target.value)}
                    placeholder="0.00"
                    data-testid="input-quick-quote"
                  />
                </div>

                {/* Special requirements */}
                <div>
                  <Label>Special Requirements</Label>
                  <Textarea
                    value={specialRequirements}
                    onChange={(e) => setSpecialRequirements(e.target.value)}
                    placeholder="Any special requirements..."
                    rows={2}
                    data-testid="input-quick-requirements"
                  />
                </div>

                {/* MOC */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={mocRequired}
                    onCheckedChange={setMocRequired}
                    data-testid="switch-quick-moc"
                  />
                  <Label>MOC Required</Label>
                </div>
                {mocRequired && (
                  <Input
                    value={mocNumber}
                    onChange={(e) => setMocNumber(e.target.value)}
                    placeholder="MOC-2024-001"
                    data-testid="input-quick-moc-number"
                  />
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="btn-quick-submit"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Service Order"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QuickServiceRequestDialog;
