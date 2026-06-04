import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  Shield,
  Briefcase,
  Download,
  RefreshCw,
  ArrowDownUp,
  Upload,
  Eye,
  Paperclip,
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import {
  useCrewDocumentsData,
  useRoleRequiredDocuments,
  DOCUMENT_TYPES,
  COMMON_COUNTRIES,
  type CrewDocument,
} from "@/features/crew";
import { useAuthedObjectUrl } from "@/components/UnifiedCrewManagement/crew-roster-shared";

/**
 * Authed "view" link for a private document scan. The object endpoint needs
 * Bearer auth, so we resolve a blob URL (same pattern as crew photos) rather
 * than linking the raw /objects/… path which would 401.
 */
function DocFileLink({
  filePath,
  testId,
  label = "View",
}: {
  filePath: string;
  testId?: string;
  label?: string;
}) {
  const url = useAuthedObjectUrl(filePath);
  if (!url) {
    return (
      <span className="text-xs text-muted-foreground" data-testid={testId}>
        Loading…
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary underline"
      data-testid={testId}
    >
      <Eye className="h-3 w-3" /> {label}
    </a>
  );
}

// Two-bucket grouping per the Figma template: identity + medical papers vs.
// training / professional endorsements.
const IDENTITY_MEDICAL_TYPES = ["passport", "seaman_book", "visa", "medical"];

function getDocCategory(type: string): "identity_medical" | "training" {
  return IDENTITY_MEDICAL_TYPES.includes(type) ? "identity_medical" : "training";
}

interface CrewDocumentsTabProps {
  crewId: string;
  crewName: string;
  rank?: string | null;
}

export function CrewDocumentsTab({ crewId, crewName, rank }: CrewDocumentsTabProps) {
  const {
    documents,
    isLoading,
    form,
    isFormOpen,
    setIsFormOpen,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    selectedDoc,
    isEditing,
    createMutation,
    updateMutation,
    deleteMutation,
    handleOpenAddForm,
    handleOpenEditForm,
    handleCloseForm,
    handleOpenDeleteDialog,
    onSubmit,
    stagedFile,
    setStagedFile,
    uploadError,
    isSaving,
    getDocumentTypeLabel,
    getExpiryStatus,
  } = useCrewDocumentsData(crewId);

  const [sortBy, setSortBy] = useState<"expiry" | "type" | "status">("expiry");

  // Rank expiry levels so the most urgent documents float to the top.
  const expiryRank: Record<string, number> = {
    expired: 0,
    critical: 1,
    warning: 2,
    notice: 3,
    ok: 4,
  };

  const sortDocs = (docs: CrewDocument[]) =>
    [...docs].sort((a, b) => {
      if (sortBy === "type") {
        return getDocumentTypeLabel(a.documentType).localeCompare(
          getDocumentTypeLabel(b.documentType)
        );
      }
      if (sortBy === "status") {
        const ra = expiryRank[getExpiryStatus(a.expiresAt)?.level ?? "ok"] ?? 5;
        const rb = expiryRank[getExpiryStatus(b.expiresAt)?.level ?? "ok"] ?? 5;
        return ra - rb;
      }
      // "expiry" — soonest actual expiry date first; documents without an expiry
      // date sink to the bottom.
      const ta = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });

  // Documents that are expired or expiring within 60 days need crew action.
  const needsAction = documents.filter((doc: CrewDocument) => {
    const level = getExpiryStatus(doc.expiresAt)?.level;
    return level === "expired" || level === "critical" || level === "warning";
  });

  // Documents this crew member's ROLE requires (empty when the role declares
  // none — the section is hidden in that case, preserving legacy behaviour).
  const requiredDocuments = useRoleRequiredDocuments(rank);
  const requiredStatuses = requiredDocuments.map((type) => {
    const matches = documents.filter((doc: CrewDocument) => doc.documentType === type);
    if (matches.length === 0) {
      return { type, tone: "missing" as const, label: "Missing" };
    }
    // Best-case across all docs of this type (matches the backend "best document
    // per type" rule): a document with no expiry, or any current valid copy,
    // satisfies the requirement even if an older expired copy also exists.
    const hasValid = matches.some((doc) => {
      const level = getExpiryStatus(doc.expiresAt)?.level;
      return !level || level === "ok";
    });
    return hasValid
      ? { type, tone: "ok" as const, label: "Valid" }
      : { type, tone: "due" as const, label: "Due soon" };
  });
  const requiredToneClass: Record<"ok" | "due" | "missing", string> = {
    ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    due: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    missing: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  };

  const handleExportCsv = () => {
    const header = ["Type", "Number", "Country", "Authority", "Issued", "Expires", "Status", "Notes"];
    const rows = documents.map((doc: CrewDocument) => [
      getDocumentTypeLabel(doc.documentType),
      doc.documentNumber || "",
      doc.issuingCountry || "",
      doc.issuingAuthority || "",
      doc.issuedAt ? format(new Date(doc.issuedAt), "yyyy-MM-dd") : "",
      doc.expiresAt ? format(new Date(doc.expiresAt), "yyyy-MM-dd") : "",
      getExpiryStatus(doc.expiresAt)?.label ?? "",
      (doc.notes || "").replace(/\s+/g, " ").trim(),
    ]);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${crewName.replace(/\s+/g, "_")}_documents.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="py-4">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderExpiryIcon = (level: string) =>
    level === "expired" || level === "critical" ? (
      <AlertTriangle className="h-3 w-3" />
    ) : level === "warning" ? (
      <AlertCircle className="h-3 w-3" />
    ) : level === "notice" ? (
      <Info className="h-3 w-3" />
    ) : (
      <Check className="h-3 w-3" />
    );

  const identityMedicalDocs = sortDocs(
    documents.filter((d: CrewDocument) => getDocCategory(d.documentType) === "identity_medical")
  );
  const trainingDocs = sortDocs(
    documents.filter((d: CrewDocument) => getDocCategory(d.documentType) === "training")
  );

  const renderDocTable = (docs: CrewDocument[], emptyMsg: string) => {
    if (docs.length === 0) {
      return <div className="py-4 text-center text-sm text-muted-foreground">{emptyMsg}</div>;
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Number</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map((doc: CrewDocument) => {
            const expiryStatus = getExpiryStatus(doc.expiresAt);
            return (
              <TableRow key={doc.id} data-testid={`doc-row-${doc.id}`}>
                <TableCell className="font-medium">
                  {getDocumentTypeLabel(doc.documentType)}
                </TableCell>
                <TableCell className="font-mono text-sm">{doc.documentNumber || "-"}</TableCell>
                <TableCell>{doc.issuingCountry || "-"}</TableCell>
                <TableCell>
                  {doc.expiresAt ? format(new Date(doc.expiresAt), "MMM d, yyyy") : "-"}
                </TableCell>
                <TableCell>
                  {expiryStatus && (
                    <Badge
                      variant="secondary"
                      className={`text-xs flex items-center gap-1 w-fit ${expiryStatus.className}`}
                    >
                      {renderExpiryIcon(expiryStatus.level)}
                      {expiryStatus.label}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {doc.filePath ? (
                      <DocFileLink
                        filePath={doc.filePath}
                        label=""
                        testId={`link-view-doc-${doc.id}`}
                      />
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenEditForm(doc)}
                      data-testid={`button-edit-doc-${doc.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() => handleOpenDeleteDialog(doc)}
                      data-testid={`button-delete-doc-${doc.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documents & Certifications ({documents.length})
          </h3>
          <div className="flex items-center gap-2">
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as "expiry" | "type" | "status")}
            >
              <SelectTrigger className="h-9 w-[160px]" data-testid="select-doc-sort">
                <ArrowDownUp className="mr-1 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expiry">Sort: Expiry soon</SelectItem>
                <SelectItem value="type">Sort: Document type</SelectItem>
                <SelectItem value="status">Sort: Status</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              disabled={documents.length === 0}
              data-testid="button-export-documents"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button size="sm" onClick={handleOpenAddForm} data-testid="button-add-document">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {needsAction.length > 0 && (
          <div
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3"
            data-testid="banner-docs-needs-action"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              {needsAction.length} document{needsAction.length > 1 ? "s need" : " needs"} attention
            </div>
            <div className="mt-2 space-y-1.5">
              {needsAction.map((doc: CrewDocument) => {
                const status = getExpiryStatus(doc.expiresAt);
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-2 text-sm"
                    data-testid={`needs-action-${doc.id}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{getDocumentTypeLabel(doc.documentType)}</span>
                      {status && (
                        <Badge
                          variant="secondary"
                          className={`text-xs flex items-center gap-1 ${status.className}`}
                        >
                          {renderExpiryIcon(status.level)}
                          {status.level === "expired"
                            ? "Expired"
                            : `Expires in ${status.label}`}
                        </Badge>
                      )}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEditForm(doc)}
                      data-testid={`button-renew-doc-${doc.id}`}
                    >
                      <RefreshCw className="mr-1 h-3.5 w-3.5" />
                      Renew
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {requiredStatuses.length > 0 && (
          <div
            className="rounded-lg border border-white/10 bg-white/[0.02] p-3"
            data-testid="section-required-documents"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <FileText className="h-4 w-4" />
              Required for {rank || "this role"}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {requiredStatuses.map((item) => (
                <Badge
                  key={item.type}
                  variant="secondary"
                  className={`flex items-center gap-1 border text-xs ${requiredToneClass[item.tone]}`}
                  data-testid={`required-doc-${item.type}`}
                >
                  <span className="font-medium">{getDocumentTypeLabel(item.type)}</span>
                  <span className="opacity-80">· {item.label}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Card>
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-sm flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5" />
              Identity &amp; medical
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {renderDocTable(identityMedicalDocs, "No identity or medical documents on file")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              Training certificates
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {renderDocTable(trainingDocs, "No training certificates on file")}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Document" : "Add Document"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? `Update document details for ${crewName}`
                : `Add a new document for ${crewName}`}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((d) => onSubmit(d, true))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="action"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Action</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-doc-action">
                          <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="new">New document</SelectItem>
                        <SelectItem value="renewal">Renewal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="documentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-doc-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
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
                name="documentNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., AB1234567"
                        data-testid="input-doc-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="issuedAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-doc-issued" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expiresAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiry Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-doc-expires" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="issuingCountry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issuing Country</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-doc-country">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COMMON_COUNTRIES.map((country) => (
                          <SelectItem key={country} value={country}>
                            {country}
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
                name="issuingAuthority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issuing Authority</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Maritime Authority"
                        data-testid="input-doc-authority"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reminderLeadDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Renewal reminder</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-doc-reminder">
                          <SelectValue placeholder="Select lead time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="30">30 days before expiry</SelectItem>
                        <SelectItem value="60">60 days before expiry</SelectItem>
                        <SelectItem value="90">90 days before expiry</SelectItem>
                        <SelectItem value="120">120 days before expiry</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      A renewal task is raised automatically once the document is within
                      this many days of expiry.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Additional notes about this document"
                        className="min-h-[60px]"
                        data-testid="input-doc-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Scan / file (Optional)</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    onChange={(e) => setStagedFile(e.target.files?.[0] ?? null)}
                    data-testid="input-doc-file"
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  PDF, PNG or JPEG up to 10 MB.
                  {selectedDoc?.filePath ? (
                    <span className="ml-1 inline-flex items-center gap-1">
                      A file is already attached.
                      <DocFileLink
                        filePath={selectedDoc.filePath}
                        label="View current"
                        testId="link-doc-file-current"
                      />
                    </span>
                  ) : null}
                </p>
                {stagedFile ? (
                  <p
                    className="flex items-center gap-1 text-xs text-foreground"
                    data-testid="text-doc-file-staged"
                  >
                    <Paperclip className="h-3 w-3" /> {stagedFile.name}
                  </p>
                ) : null}
                {uploadError ? (
                  <p
                    className="text-xs text-destructive"
                    data-testid="text-doc-file-error"
                  >
                    {uploadError}
                  </p>
                ) : null}
              </FormItem>
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseForm}
                  data-testid="button-cancel-doc-form"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isSaving}
                  onClick={form.handleSubmit((d) => onSubmit(d, false))}
                  data-testid="button-savedraft-doc-form"
                >
                  {isSaving ? "Saving..." : "Save draft"}
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  data-testid="button-submit-doc-form"
                >
                  <Upload className="mr-1 h-4 w-4" />
                  {isSaving
                    ? "Saving..."
                    : stagedFile
                      ? "Save & upload"
                      : isEditing
                        ? "Update Document"
                        : "Add Document"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this{" "}
              {getDocumentTypeLabel(selectedDoc?.documentType || "")}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-doc">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedDoc && deleteMutation.mutate(selectedDoc.id)}
              className="bg-red-500 hover:bg-red-600"
              data-testid="button-confirm-delete-doc"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
