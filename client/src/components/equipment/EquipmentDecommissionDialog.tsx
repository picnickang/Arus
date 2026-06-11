import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { useForm, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Equipment,
  InsertDecommissionEvent,
  decommissionReasonEnum,
  saleDetailsSchema,
  disposalDetailsSchema,
} from "@shared/schema";
import { AlertTriangle, ChevronDown, DollarSign, Trash2, RefreshCw, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";

interface EquipmentDecommissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
  replacementOptions?: Equipment[];
  onSubmit: (equipmentId: string, data: InsertDecommissionEvent) => void;
  isPending?: boolean;
}

const decommissionFormSchema = z.object({
  reason: decommissionReasonEnum,
  eventDate: z.string().min(1, "Event date is required"),
  authorizedBy: z.string().optional(),
  finalCondition: z.string().optional(),
  notes: z.string().optional(),
  saleDetails: saleDetailsSchema.optional(),
  disposalDetails: disposalDetailsSchema.optional(),
  replacementEquipmentId: z.string().optional(),
  bookValueAtRemoval: z.number().optional(),
  residualValue: z.number().optional(),
});

type DecommissionFormData = z.infer<typeof decommissionFormSchema>;

const REASON_LABELS: Record<string, string> = {
  sold: "Sold",
  scrapped: "Scrapped / Disposed",
  replaced: "Replaced",
  end_of_life: "End of Life",
  transferred: "Transferred to Another Vessel",
  damaged_beyond_repair: "Damaged Beyond Repair",
};

const CONDITION_OPTIONS = ["excellent", "good", "fair", "poor", "non_functional"];

function formatCondition(condition: string): string {
  return condition
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function calculateDepreciation(
  purchaseValue: number | null | undefined,
  purchaseDate: Date | string | null | undefined
): { bookValue: number; depreciationYears: number } {
  if (!purchaseValue || !purchaseDate) {
    return { bookValue: 0, depreciationYears: 0 };
  }

  const purchaseDateObj = typeof purchaseDate === "string" ? new Date(purchaseDate) : purchaseDate;
  const now = new Date();
  const yearsOwned = (now.getTime() - purchaseDateObj.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const usefulLifeYears = 10;
  const depreciationRate = 1 / usefulLifeYears;
  const depreciatedValue = purchaseValue * (1 - Math.min(yearsOwned * depreciationRate, 1));

  return {
    bookValue: Math.max(0, depreciatedValue),
    depreciationYears: Math.round(yearsOwned * 10) / 10,
  };
}

export function EquipmentDecommissionDialog({
  open,
  onOpenChange,
  equipment,
  replacementOptions = [],
  onSubmit,
  isPending,
}: EquipmentDecommissionDialogProps) {
  const { toast } = useToast();
  const [saleOpen, setSaleOpen] = useState(false);
  const [disposalOpen, setDisposalOpen] = useState(false);

  const depreciation = equipment
    ? calculateDepreciation(equipment.purchaseValue, equipment.purchaseDate)
    : { bookValue: 0, depreciationYears: 0 };

  const form = useForm<DecommissionFormData, unknown, DecommissionFormData>({
    resolver: zodResolver(decommissionFormSchema),
    defaultValues: {
      reason: "end_of_life",
      eventDate: new Date().toISOString().split("T")[0],
      authorizedBy: "",
      finalCondition: "",
      notes: "",
      saleDetails: {
        salePrice: undefined,
        currency: "USD",
        buyerName: "",
        buyerContact: "",
      },
      disposalDetails: {
        method: "",
        vendor: "",
        cost: undefined,
        environmentalNotes: "",
      },
      replacementEquipmentId: "",
      bookValueAtRemoval: depreciation.bookValue,
      residualValue: undefined,
    } as DefaultValues<DecommissionFormData>,
  });

  const selectedReason = form.watch("reason");
  const showSaleDetails = selectedReason === "sold";
  const showDisposalDetails =
    selectedReason === "scrapped" || selectedReason === "damaged_beyond_repair";
  const showReplacementLink = selectedReason === "replaced";

  const handleSubmit = (data: DecommissionFormData) => {
    if (!equipment) {
      return;
    }
    if (!equipment.orgId) {
      toast({
        title: "Cannot decommission equipment",
        description:
          "Equipment is missing an organization assignment. Please contact an administrator.",
        variant: "destructive",
      });
      return;
    }

    const submissionData: InsertDecommissionEvent = {
      orgId: equipment.orgId,
      equipmentId: equipment.id,
      reason: data.reason,
      eventDate: new Date(data.eventDate),
      authorizedBy: data.authorizedBy || undefined,
      finalCondition: data.finalCondition || undefined,
      notes: data.notes || undefined,
      saleDetails: showSaleDetails ? data.saleDetails : undefined,
      disposalDetails: showDisposalDetails ? data.disposalDetails : undefined,
      replacementEquipmentId:
        showReplacementLink && data.replacementEquipmentId
          ? data.replacementEquipmentId
          : undefined,
      bookValueAtRemoval: data.bookValueAtRemoval ?? depreciation.bookValue,
      residualValue: data.residualValue,
    };

    onSubmit(equipment.id, submissionData);
  };

  if (!equipment) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Decommission Equipment
          </DialogTitle>
          <DialogDescription>
            Remove <span className="font-medium">{equipment.name}</span> from active service. This
            action will mark the equipment as inactive and record the decommission details.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-md p-4 space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Equipment:</span>{" "}
              <span className="font-medium">{equipment.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>{" "}
              <span className="font-medium">{equipment.type}</span>
            </div>
            {equipment.purchaseValue && (
              <>
                <div>
                  <span className="text-muted-foreground">Purchase Value:</span>{" "}
                  <span className="font-medium">{formatCurrency(equipment.purchaseValue)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Est. Book Value:</span>{" "}
                  <span className="font-medium">{formatCurrency(depreciation.bookValue)}</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({depreciation.depreciationYears} yrs)
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Decommission *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      data-testid="select-decommission-reason"
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(REASON_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Decommission Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-decommission-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="authorizedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Authorized By</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Chief Engineer"
                        {...field}
                        data-testid="input-authorized-by"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="finalCondition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Final Condition</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
                      data-testid="select-final-condition"
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CONDITION_OPTIONS.map((condition) => (
                          <SelectItem key={condition} value={condition}>
                            {formatCondition(condition)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {showSaleDetails && (
              <Collapsible open={saleOpen} onOpenChange={setSaleOpen} className="border rounded-md">
                <CollapsibleTrigger
                  className="flex items-center justify-between w-full p-4"
                  data-testid="collapsible-sale-details"
                >
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span className="font-medium">Sale Details</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${saleOpen ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="saleDetails.salePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sale Price</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="15000"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? parseFloat(e.target.value) : undefined
                                )
                              }
                              data-testid="input-sale-price"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="saleDetails.currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "USD"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="USD" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                              <SelectItem value="SGD">SGD</SelectItem>
                              <SelectItem value="GBP">GBP</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="saleDetails.buyerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Buyer Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Company or individual name"
                              {...field}
                              data-testid="input-buyer-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="saleDetails.buyerContact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Buyer Contact</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Email or phone"
                              {...field}
                              data-testid="input-buyer-contact"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {showDisposalDetails && (
              <Collapsible
                open={disposalOpen}
                onOpenChange={setDisposalOpen}
                className="border rounded-md"
              >
                <CollapsibleTrigger
                  className="flex items-center justify-between w-full p-4"
                  data-testid="collapsible-disposal-details"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    <span className="font-medium">Disposal Details</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${disposalOpen ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="disposalDetails.method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Disposal Method</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="recycled">Recycled</SelectItem>
                              <SelectItem value="landfill">Landfill</SelectItem>
                              <SelectItem value="hazmat_disposal">Hazmat Disposal</SelectItem>
                              <SelectItem value="parts_salvaged">Parts Salvaged</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="disposalDetails.vendor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Disposal Vendor</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Vendor name"
                              {...field}
                              data-testid="input-disposal-vendor"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="disposalDetails.cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Disposal Cost</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="500"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? parseFloat(e.target.value) : undefined
                              )
                            }
                            data-testid="input-disposal-cost"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="disposalDetails.environmentalNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Environmental Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any environmental considerations or certifications..."
                            {...field}
                            data-testid="textarea-environmental-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>
            )}

            {showReplacementLink && replacementOptions.length > 0 && (
              <div className="border rounded-md p-4">
                <div className="flex items-center gap-2 mb-4">
                  <RefreshCw className="h-4 w-4" />
                  <span className="font-medium">Replacement Equipment</span>
                </div>
                <FormField
                  control={form.control}
                  name="replacementEquipmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Link to Replacement</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                        data-testid="select-replacement"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select replacement equipment" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {replacementOptions.map((eq) => (
                            <SelectItem key={eq.id} value={eq.id}>
                              {eq.name} ({eq.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <Separator />

            <div className="border rounded-md p-4">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4" />
                <span className="font-medium">Financial Summary</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bookValueAtRemoval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Book Value at Removal</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={String(Math.round(depreciation.bookValue))}
                          {...field}
                          value={field.value ?? Math.round(depreciation.bookValue)}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                          data-testid="input-book-value"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="residualValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Residual/Salvage Value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                          data-testid="input-residual-value"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional information about the decommission..."
                      {...field}
                      data-testid="textarea-decommission-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-decommission"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isPending}
                data-testid="button-submit-decommission"
              >
                {isPending ? "Processing..." : "Confirm Decommission"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
