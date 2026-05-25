import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import type { Supplier, SupplierFormData, VendorType } from "../types";
import { PAYMENT_TERMS, VENDOR_TYPES, SERVICE_CAPABILITIES, EQUIPMENT_TYPES } from "../types";

const optionalNumber = z.preprocess(
  (val) =>
    val === "" || val === undefined || val === null || Number.isNaN(Number(val))
      ? undefined
      : Number(val),
  z.number().optional()
);

const optionalStringArray = z.preprocess(
  (val) =>
    typeof val === "string"
      ? val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : val,
  z.array(z.string()).optional()
);

const supplierFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(10, "Code must be at most 10 characters"),
  type: z.enum(["supplier", "service_provider", "both"]),
  contactName: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  email: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().email("Invalid email").optional()
  ),
  phone: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  address: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  paymentTerms: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  isActive: z.boolean().optional(),
  notes: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  leadTimeDays: optionalNumber.refine((v) => v === undefined || v >= 0, {
    message: "Must be non-negative",
  }),
  qualityRating: optionalNumber.refine((v) => v === undefined || (v >= 0 && v <= 10), {
    message: "Must be 0-10",
  }),
  defectRate: optionalNumber.refine((v) => v === undefined || (v >= 0 && v <= 100), {
    message: "Must be 0-100",
  }),
  isPreferred: z.boolean().optional(),
  serviceCapabilities: optionalStringArray,
  certifications: optionalStringArray,
  responseSlaHours: optionalNumber.refine((v) => v === undefined || v >= 0, {
    message: "Must be non-negative",
  }),
  equipmentTypesServiced: optionalStringArray,
});

interface SupplierFormProps {
  supplier?: Supplier;
  defaultType?: VendorType;
  onSubmit: (data: SupplierFormData) => void;
  onCancel?: () => void;
  isPending?: boolean;
}

export function SupplierForm({
  supplier,
  defaultType = "supplier",
  onSubmit,
  onCancel,
  isPending,
}: SupplierFormProps) {
  const form = useForm<SupplierFormData, unknown, SupplierFormData>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: supplier?.name ?? "",
      code: supplier?.code ?? "",
      type: supplier?.type ?? defaultType,
      contactName: supplier?.contactName ?? "",
      email: supplier?.email ?? "",
      phone: supplier?.phone ?? "",
      address: supplier?.address ?? "",
      paymentTerms: supplier?.paymentTerms ?? "",
      isActive: supplier?.isActive ?? true,
      notes: supplier?.notes ?? "",
      leadTimeDays: supplier?.leadTimeDays ?? undefined,
      qualityRating: supplier?.qualityRating ?? 5,
      defectRate: supplier?.defectRate ?? 0,
      isPreferred: supplier?.isPreferred ?? false,
      serviceCapabilities: supplier?.serviceCapabilities ?? [],
      certifications: supplier?.certifications ?? [],
      responseSlaHours: supplier?.responseSlaHours ?? undefined,
      equipmentTypesServiced: supplier?.equipmentTypesServiced ?? [],
    },
  });

  const vendorType = form.watch("type");
  const isSupplier = vendorType === "supplier" || vendorType === "both";
  const isServiceProvider = vendorType === "service_provider" || vendorType === "both";

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        data-testid="supplier-form"
      >
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Vendor name" data-testid="input-supplier-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="ABC" data-testid="input-supplier-code" />
                </FormControl>
                <FormDescription>Short code (2-10 chars)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-vendor-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {VENDOR_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
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
            name="contactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="John Doe" data-testid="input-contact-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    {...field}
                    placeholder="vendor@example.com"
                    data-testid="input-supplier-email"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="+1 234 567 8900" data-testid="input-phone" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="123 Main St, City" data-testid="input-address" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {isSupplier && (
          <div className="space-y-4 p-4 border rounded-md bg-muted/30">
            <h4 className="font-medium text-sm text-muted-foreground">Supplier Details</h4>
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="leadTimeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Time (days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value ?? ""}
                        data-testid="input-lead-time"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="qualityRating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quality Rating</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        {...field}
                        value={field.value ?? ""}
                        data-testid="input-quality-rating"
                      />
                    </FormControl>
                    <FormDescription>0-10 scale</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defectRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Defect Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        {...field}
                        value={field.value ?? ""}
                        data-testid="input-defect-rate"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="paymentTerms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Terms</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-payment-terms">
                        <SelectValue placeholder="Select payment terms" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_TERMS.map((term) => (
                        <SelectItem key={term} value={term}>
                          {term}
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

        {isServiceProvider && (
          <div className="space-y-4 p-4 border rounded-md bg-muted/30">
            <h4 className="font-medium text-sm text-muted-foreground">Service Provider Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="responseSlaHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Response SLA (hours)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value ?? ""}
                        data-testid="input-response-sla"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="certifications"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Certifications</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={Array.isArray(field.value) ? field.value.join(", ") : ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                          )
                        }
                        placeholder="ISO 9001, DNV-GL"
                        data-testid="input-certifications"
                      />
                    </FormControl>
                    <FormDescription>Comma-separated list</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="serviceCapabilities"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Capabilities</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={Array.isArray(field.value) ? field.value.join(", ") : ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        )
                      }
                      placeholder="Engine Overhaul, Electrical Systems"
                      data-testid="input-service-capabilities"
                    />
                  </FormControl>
                  <FormDescription>Available: {SERVICE_CAPABILITIES.join(", ")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="equipmentTypesServiced"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipment Types Serviced</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={Array.isArray(field.value) ? field.value.join(", ") : ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        )
                      }
                      placeholder="Main Engine, Generator"
                      data-testid="input-equipment-types"
                    />
                  </FormControl>
                  <FormDescription>Available: {EQUIPMENT_TYPES.join(", ")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Additional notes" data-testid="input-notes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-wrap gap-6">
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-is-active"
                  />
                </FormControl>
                <FormLabel className="!mt-0">Active</FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isPreferred"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-is-preferred"
                  />
                </FormControl>
                <FormLabel className="!mt-0">Preferred</FormLabel>
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={isPending} data-testid="button-submit-supplier">
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {supplier ? "Update" : "Create"}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
