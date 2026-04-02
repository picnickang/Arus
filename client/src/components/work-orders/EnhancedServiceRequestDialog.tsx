import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Wrench, Plus, Trash2, AlertTriangle, CalendarIcon, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { useServiceProviders } from "@/features/suppliers/hooks/useSuppliers";
import { useEquipmentList } from "@/features/vessels/hooks/useVessels";
import { cn } from "@/lib/utils";
import { EquipmentMultiSelect, DatePickerField } from "./RequestDialogHelpers";

const SEVERITY_OPTIONS = [
  { value: "general", label: "General", color: "bg-blue-100 text-blue-800" },
  { value: "safety", label: "Safety", color: "bg-amber-100 text-amber-800" },
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-800" },
];

const ASSISTANCE_TAGS = [
  { value: "servicing", label: "Servicing" },
  { value: "calibration", label: "Calibration" },
  { value: "pressure_test", label: "Pressure Test" },
  { value: "replacement", label: "Replacement" },
  { value: "certificate_renewal", label: "Certificate Renewal" },
  { value: "repair", label: "Repair" },
];

interface CertificateItem { id: string; name: string; expiryDate?: Date; remarks: string; }

interface EnhancedServiceRequestData {
  serviceProviderId: string;
  equipmentIds: string[];
  severity: string;
  assistanceTags: string[];
  symptomDescription: string;
  probableCause?: string;
  actionTakenSoFar?: string;
  isRecurringDefect: boolean;
  requestedStartDate?: Date;
  requestedEndDate?: Date;
  estimatedDurationHours?: number;
  quotedAmount?: number;
  notes?: string;
  mocRequired: boolean;
  mocNumber?: string;
  certificateItems?: Array<{ name: string; expiryDate?: string; remarks?: string }>;
  scope?: string;
}

interface InitialServiceOrderData {
  serviceProviderId?: string;
  scope?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  estimatedDurationHours?: number;
}

interface EnhancedServiceRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: EnhancedServiceRequestData) => void;
  isPending: boolean;
  initialData?: InitialServiceOrderData;
  isEditing?: boolean;
  defaultExpanded?: boolean;
}

let sessionAdvancedState: boolean | null = null;

export function EnhancedServiceRequestDialog({ open, onOpenChange, onSubmit, isPending, initialData, isEditing = false, defaultExpanded = false }: EnhancedServiceRequestDialogProps) {
  const { data: providers = [] } = useServiceProviders();
  const { data: equipment = [] } = useEquipmentList();

  const [providerId, setProviderId] = useState("");
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [severity, setSeverity] = useState("general");
  const [assistanceTags, setAssistanceTags] = useState<string[]>([]);
  const [symptomDescription, setSymptomDescription] = useState("");
  const [probableCause, setProbableCause] = useState("");
  const [actionTakenSoFar, setActionTakenSoFar] = useState("");
  const [isRecurringDefect, setIsRecurringDefect] = useState(false);
  const [requestedStartDate, setRequestedStartDate] = useState<Date | undefined>();
  const [requestedEndDate, setRequestedEndDate] = useState<Date | undefined>();
  const [estimatedHours, setEstimatedHours] = useState("");
  const [quotedAmount, setQuotedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [mocRequired, setMocRequired] = useState(false);
  const [mocNumber, setMocNumber] = useState("");
  const [certificateItems, setCertificateItems] = useState<CertificateItem[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(() => {
    if (defaultExpanded || isEditing) return true;
    if (sessionAdvancedState !== null) return sessionAdvancedState;
    return false;
  });

  const advancedSectionRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      if (defaultExpanded || isEditing) {
        setShowAdvanced(true);
      } else {
        setShowAdvanced(sessionAdvancedState ?? false);
      }
    }
  }, [open, defaultExpanded, isEditing]);

  if (open && isEditing && initialData && !initialized) {
    if (initialData.serviceProviderId) setProviderId(initialData.serviceProviderId);
    if (initialData.scope) setSymptomDescription(initialData.scope);
    if (initialData.scheduledStartDate) setRequestedStartDate(new Date(initialData.scheduledStartDate));
    if (initialData.scheduledEndDate) setRequestedEndDate(new Date(initialData.scheduledEndDate));
    if (initialData.estimatedDurationHours) setEstimatedHours(String(initialData.estimatedDurationHours));
    setInitialized(true);
  }
  
  if (!open && initialized) {
    setInitialized(false);
  }

  const showCertificates = assistanceTags.includes("certificate_renewal");

  const toggleTag = useCallback((tag: string) => {
    setAssistanceTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }, []);

  const addCertificate = useCallback(() => {
    setCertificateItems(prev => [...prev, { id: `cert-${Date.now()}`, name: "", remarks: "" }]);
  }, []);

  const updateCertificate = useCallback((id: string, field: keyof CertificateItem, value: string | Date | undefined) => {
    setCertificateItems(prev => prev.map(cert => cert.id === id ? { ...cert, [field]: value } : cert));
  }, []);

  const removeCertificate = useCallback((id: string) => {
    setCertificateItems(prev => prev.filter(cert => cert.id !== id));
  }, []);

  const resetForm = useCallback(() => {
    setProviderId(""); setSelectedEquipmentIds([]); setSeverity("general"); setAssistanceTags([]);
    setSymptomDescription(""); setProbableCause(""); setActionTakenSoFar(""); setIsRecurringDefect(false);
    setRequestedStartDate(undefined); setRequestedEndDate(undefined); setEstimatedHours(""); setQuotedAmount("");
    setNotes(""); setMocRequired(false); setMocNumber(""); setCertificateItems([]);
  }, []);

  const handleSubmit = () => {
    const data: EnhancedServiceRequestData = {
      serviceProviderId: providerId,
      equipmentIds: selectedEquipmentIds,
      severity: showAdvanced ? severity : "general",
      assistanceTags: showAdvanced ? assistanceTags : [],
      symptomDescription,
      isRecurringDefect: showAdvanced ? isRecurringDefect : false,
      requestedStartDate,
      mocRequired: showAdvanced ? mocRequired : false,
      scope: symptomDescription,
    };

    if (showAdvanced) {
      data.probableCause = probableCause || undefined;
      data.actionTakenSoFar = actionTakenSoFar || undefined;
      data.requestedEndDate = requestedEndDate;
      data.estimatedDurationHours = estimatedHours ? Number.parseFloat(estimatedHours) : undefined;
      data.quotedAmount = quotedAmount ? Number.parseFloat(quotedAmount) : undefined;
      data.notes = notes || undefined;
      data.mocNumber = mocRequired ? mocNumber || undefined : undefined;
      data.certificateItems = showCertificates && certificateItems.length > 0
        ? certificateItems.filter(c => c.name.trim()).map(c => ({ name: c.name, expiryDate: c.expiryDate?.toISOString(), remarks: c.remarks || undefined }))
        : undefined;
    }

    onSubmit(data);
  };

  const handleOpenChange = (isOpen: boolean) => { if (!isOpen) {resetForm(); setInitialized(false);} onOpenChange(isOpen); };

  const canSubmit = isEditing 
    ? symptomDescription.trim() && !isPending
    : providerId && selectedEquipmentIds.length > 0 && symptomDescription.trim() && requestedStartDate && !isPending;

  const handleAdvancedOpenChange = (newState: boolean) => {
    setShowAdvanced(newState);
    sessionAdvancedState = newState;
    if (newState) {
      setTimeout(() => {
        advancedSectionRef.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus();
      }, 150);
    } else {
      setTimeout(() => toggleRef.current?.focus(), 50);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" />{isEditing ? "Edit Service Order" : "Quick Service Request"}</DialogTitle>
          <DialogDescription>{isEditing ? "Update the service order details." : "Fill in the basics, or expand advanced options for full details."}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Service Provider *</Label>
              <Select value={providerId} onValueChange={setProviderId}>
                <SelectTrigger data-testid="select-service-provider"><SelectValue placeholder="Select provider..." /></SelectTrigger>
                <SelectContent>{providers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DatePickerField label="Requested Date" value={requestedStartDate} onChange={setRequestedStartDate} testId="date-start" />
          </div>

          <EquipmentMultiSelect equipment={equipment} selectedIds={selectedEquipmentIds} onChange={setSelectedEquipmentIds} />

          <div><Label>Description *</Label><Textarea value={symptomDescription} onChange={(e) => setSymptomDescription(e.target.value)} placeholder="Describe the work needed..." rows={3} data-testid="input-symptom" /></div>

          <Collapsible open={showAdvanced} onOpenChange={handleAdvancedOpenChange}>
            <CollapsibleTrigger asChild>
              <button
                ref={toggleRef}
                type="button"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full py-2"
                data-testid="toggle-advanced-options"
              >
                <Settings2 className="h-4 w-4" />
                {showAdvanced ? "Hide advanced options" : "Show advanced options"}
                {showAdvanced ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2">
              <div ref={advancedSectionRef} className="space-y-6 pt-4">
                <Separator />

                <div>
                  <Label>Severity</Label>
                  <div className="flex gap-2 mt-2">
                    {SEVERITY_OPTIONS.map(opt => (
                      <Badge key={opt.value} className={cn("cursor-pointer px-3 py-1", severity === opt.value ? opt.color : "bg-muted text-muted-foreground hover:bg-muted/80")} onClick={() => setSeverity(opt.value)} data-testid={`badge-severity-${opt.value}`}>
                        {opt.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">Assistance Required</Label>
                  <div className="flex flex-wrap gap-2">
                    {ASSISTANCE_TAGS.map(tag => (
                      <Badge key={tag.value} variant={assistanceTags.includes(tag.value) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleTag(tag.value)} data-testid={`tag-${tag.value}`}>
                        {tag.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Diagnostics</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Probable Cause</Label><Textarea value={probableCause} onChange={(e) => setProbableCause(e.target.value)} placeholder="What might be causing this..." rows={2} data-testid="input-probable-cause" /></div>
                    <div><Label>Action Taken So Far</Label><Textarea value={actionTakenSoFar} onChange={(e) => setActionTakenSoFar(e.target.value)} placeholder="Any troubleshooting done..." rows={2} data-testid="input-action-taken" /></div>
                  </div>
                  <div className="flex items-center space-x-2"><Switch id="recurring" checked={isRecurringDefect} onCheckedChange={setIsRecurringDefect} data-testid="switch-recurring" /><Label htmlFor="recurring">Recurring Defect</Label></div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2"><CalendarIcon className="h-4 w-4" />Scheduling</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <DatePickerField label="Requested End Date" value={requestedEndDate} onChange={setRequestedEndDate} testId="date-end" />
                    <div><Label>Estimated Hours</Label><Input type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} placeholder="0" data-testid="input-hours" /></div>
                  </div>
                  <div>
                    <Label>Quoted Amount ($)</Label><Input type="number" value={quotedAmount} onChange={(e) => setQuotedAmount(e.target.value)} placeholder="0.00" data-testid="input-quote" />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center space-x-2"><Switch id="moc" checked={mocRequired} onCheckedChange={setMocRequired} data-testid="switch-moc" /><Label htmlFor="moc">MOC (Management of Change) Required</Label></div>
                  {mocRequired && <div><Label>MOC Number</Label><Input value={mocNumber} onChange={(e) => setMocNumber(e.target.value)} placeholder="MOC-2024-001" data-testid="input-moc-number" /></div>}
                </div>

                {showCertificates && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <div className="flex items-center justify-between"><h4 className="font-medium">Certificate Renewals</h4><Button variant="outline" size="sm" onClick={addCertificate} data-testid="btn-add-certificate"><Plus className="h-4 w-4 mr-1" />Add Certificate</Button></div>
                      {certificateItems.map(cert => (
                        <div key={cert.id} className="grid grid-cols-4 gap-2 items-end">
                          <div><Label className="text-xs">Certificate Name</Label><Input value={cert.name} onChange={(e) => updateCertificate(cert.id, "name", e.target.value)} placeholder="Certificate name" data-testid={`input-cert-name-${cert.id}`} /></div>
                          <DatePickerField label="Expiry Date" value={cert.expiryDate} onChange={(d) => updateCertificate(cert.id, "expiryDate", d)} testId={`cert-expiry-${cert.id}`} compact />
                          <div><Label className="text-xs">Remarks</Label><Input value={cert.remarks} onChange={(e) => updateCertificate(cert.id, "remarks", e.target.value)} placeholder="Remarks" data-testid={`input-cert-remarks-${cert.id}`} /></div>
                          <Button variant="ghost" size="sm" onClick={() => removeCertificate(cert.id)} data-testid={`btn-remove-cert-${cert.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div><Label>Additional Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes..." rows={2} data-testid="input-notes" /></div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} data-testid="button-submit-service-request">{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{isEditing ? "Update Service Order" : "Create Service Order"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EnhancedServiceRequestDialog;
