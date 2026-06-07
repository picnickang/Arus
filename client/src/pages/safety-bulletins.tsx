import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, ShieldCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ROLE_STORAGE_KEY } from "@/config/roles";

// Roles allowed to author a safety notice. Must stay identical to the
// server gate `SAFETY_BULLETIN_WRITE_ROLES` in
// `server/domains/safety-bulletins/interfaces/routes.ts` so the UI never
// shows the authoring form to a role the API would reject (and never
// hides it from a role the API permits).
const SAFETY_BULLETIN_WRITE_ROLES = new Set([
  "system_admin",
  "company_admin",
  "chief_engineer",
  "fleet_manager",
  "captain",
  "admin",
]);

interface SafetyBulletin {
  id: string;
  title: string;
  body: string | null;
  severity: string;
  category: string;
  reference: string | null;
  effectiveDate: string | null;
  expiresAt: string | null;
  createdAt: string | null;
}

interface Vessel {
  id: string;
  name?: string;
}

const SEVERITY_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  critical: "destructive",
  warning: "default",
  advisory: "secondary",
  info: "outline",
};

const SEVERITY_OPTIONS = [
  { value: "info", label: "Info" },
  { value: "advisory", label: "Advisory" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
] as const;

const FLEET_WIDE_VALUE = "__fleet__";

const newNoticeSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  body: z.string().trim().optional(),
  severity: z.enum(["info", "advisory", "warning", "critical"]),
  vesselId: z.string().optional(),
  reference: z.string().trim().optional(),
});

type NewNoticeForm = z.infer<typeof newNoticeSchema>;

function formatDate(value: string | null): string {
  if (!value) {return "";}
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {return "";}
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function currentRole(): string | null {
  if (typeof window === "undefined") {return null;}
  try {
    return window.localStorage.getItem(ROLE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function NewNoticeDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: vesselData } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
    enabled: open,
  });
  const vessels = Array.isArray(vesselData) ? vesselData : [];

  const form = useForm<NewNoticeForm>({
    resolver: zodResolver(newNoticeSchema),
    defaultValues: {
      title: "",
      body: "",
      severity: "info",
      vesselId: FLEET_WIDE_VALUE,
      reference: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: NewNoticeForm) => {
    const payload: Record<string, unknown> = {
      title: values.title,
      severity: values.severity,
    };
    if (values.body && values.body.length > 0) {payload["body"] = values.body;}
    if (values.reference && values.reference.length > 0)
      {payload["reference"] = values.reference;}
    if (values.vesselId && values.vesselId !== FLEET_WIDE_VALUE)
      {payload["vesselId"] = values.vesselId;}

    try {
      await apiRequest("POST", "/api/safety-bulletins", payload);
      await queryClient.invalidateQueries({
        queryKey: ["/api/safety-bulletins"],
      });
      toast({ title: "Safety notice posted" });
      form.reset();
      setOpen(false);
    } catch (err) {
      toast({
        title: "Could not post notice",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-new-notice">
          <Plus className="mr-1 h-4 w-4" /> New notice
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-new-notice">
        <DialogHeader>
          <DialogTitle>Post a safety notice</DialogTitle>
          <DialogDescription>
            Share a safety notice with the crew. Leave the vessel as
            Fleet-wide to notify everyone.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Lifeboat drill scheduled"
                      data-testid="input-notice-title"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="What does the crew need to know?"
                      data-testid="input-notice-body"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-notice-severity">
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SEVERITY_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          data-testid={`option-severity-${opt.value}`}
                        >
                          {opt.label}
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
              name="vesselId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vessel</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-notice-vessel">
                        <SelectValue placeholder="Fleet-wide" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem
                        value={FLEET_WIDE_VALUE}
                        data-testid="option-vessel-fleet"
                      >
                        Fleet-wide (all vessels)
                      </SelectItem>
                      {vessels.map((v) => (
                        <SelectItem
                          key={v.id}
                          value={v.id}
                          data-testid={`option-vessel-${v.id}`}
                        >
                          {v.name || v.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Fleet-wide notices appear for every vessel.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. ISM 7.3 or circular number"
                      data-testid="input-notice-reference"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel-notice"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-submit-notice"
              >
                {isSubmitting ? "Posting..." : "Post notice"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function SafetyBulletinsPage() {
  const { data, isLoading } = useQuery<SafetyBulletin[]>({
    queryKey: ["/api/safety-bulletins"],
    refetchInterval: 60000,
  });

  const canPost = useMemo(() => {
    const role = currentRole();
    return role !== null && SAFETY_BULLETIN_WRITE_ROLES.has(role);
  }, []);

  const bulletins = Array.isArray(data) ? data : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Link href="/home">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1
          className="flex items-center gap-2 text-lg font-semibold"
          data-testid="text-page-title"
        >
          <ShieldCheck className="h-5 w-5 text-primary" /> Safety Notices
        </h1>
        {canPost && (
          <div className="ml-auto">
            <NewNoticeDialog />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3" data-testid="loading-safety-bulletins">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : bulletins.length === 0 ? (
        <Card data-testid="empty-safety-bulletins">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No safety notices at this time.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bulletins.map((b) => (
            <Card key={b.id} data-testid={`card-safety-bulletin-${b.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base" data-testid={`text-title-${b.id}`}>
                    {b.title}
                  </CardTitle>
                  <Badge
                    variant={SEVERITY_VARIANT[b.severity] ?? "outline"}
                    data-testid={`badge-severity-${b.id}`}
                  >
                    {b.severity}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {[formatDate(b.effectiveDate), b.reference]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </CardHeader>
              {b.body && (
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  {b.body}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
