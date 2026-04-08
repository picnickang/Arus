import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Edit, Trash2, AlertTriangle, AlertCircle, Info, Check, Shield, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { useCrewDocumentsData, DOCUMENT_TYPES, COMMON_COUNTRIES, type CrewDocument } from "@/features/crew";

const TRAVEL_IDENTITY_TYPES = ["passport", "seaman_book", "visa"];
const PROFESSIONAL_TYPES = ["endorsement"];
const MEDICAL_TYPES = ["medical"];

function getDocCategory(type: string): "travel" | "medical" | "professional" {
  if (TRAVEL_IDENTITY_TYPES.includes(type)) return "travel";
  if (MEDICAL_TYPES.includes(type)) return "medical";
  return "professional";
}

interface CrewDocumentsTabProps { crewId: string; crewName: string; }

export function CrewDocumentsTab({ crewId, crewName }: CrewDocumentsTabProps) {
  const { documents, isLoading, form, isFormOpen, setIsFormOpen, isDeleteDialogOpen, setIsDeleteDialogOpen, selectedDoc, isEditing, createMutation, updateMutation, deleteMutation, handleOpenAddForm, handleOpenEditForm, handleCloseForm, handleOpenDeleteDialog, onSubmit, getDocumentTypeLabel, getExpiryStatus } = useCrewDocumentsData(crewId);

  if (isLoading) {return (<Card><CardHeader className="py-4"><Skeleton className="h-6 w-32" /></CardHeader><CardContent><div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div></CardContent></Card>);}

  const renderExpiryIcon = (level: string) => level === "expired" || level === "critical" ? <AlertTriangle className="h-3 w-3" /> : level === "warning" ? <AlertCircle className="h-3 w-3" /> : level === "notice" ? <Info className="h-3 w-3" /> : <Check className="h-3 w-3" />;

  const travelDocs = documents.filter((d: CrewDocument) => getDocCategory(d.documentType) === "travel");
  const medicalDocs = documents.filter((d: CrewDocument) => getDocCategory(d.documentType) === "medical");
  const professionalDocs = documents.filter((d: CrewDocument) => getDocCategory(d.documentType) === "professional");

  const renderDocTable = (docs: CrewDocument[], emptyMsg: string) => {
    if (docs.length === 0) return <div className="py-4 text-center text-sm text-muted-foreground">{emptyMsg}</div>;
    return (
      <Table>
        <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Number</TableHead><TableHead>Country</TableHead><TableHead>Expires</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {docs.map((doc: CrewDocument) => { const expiryStatus = getExpiryStatus(doc.expiresAt); return (
            <TableRow key={doc.id} data-testid={`doc-row-${doc.id}`}>
              <TableCell className="font-medium">{getDocumentTypeLabel(doc.documentType)}</TableCell>
              <TableCell className="font-mono text-sm">{doc.documentNumber || "-"}</TableCell>
              <TableCell>{doc.issuingCountry || "-"}</TableCell>
              <TableCell>{doc.expiresAt ? format(new Date(doc.expiresAt), "MMM d, yyyy") : "-"}</TableCell>
              <TableCell>{expiryStatus && (<Badge variant="secondary" className={`text-xs flex items-center gap-1 w-fit ${expiryStatus.className}`}>{renderExpiryIcon(expiryStatus.level)}{expiryStatus.label}</Badge>)}</TableCell>
              <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditForm(doc)} data-testid={`button-edit-doc-${doc.id}`}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleOpenDeleteDialog(doc)} data-testid={`button-delete-doc-${doc.id}`}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
            </TableRow>
          ); })}
        </TableBody>
      </Table>
    );
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2"><FileText className="h-4 w-4" />Documents & Certifications ({documents.length})</h3>
          <Button size="sm" onClick={handleOpenAddForm} data-testid="button-add-document"><Plus className="h-4 w-4 mr-1" />Add</Button>
        </div>

        <Card>
          <CardHeader className="py-3 pb-1"><CardTitle className="text-sm flex items-center gap-2"><Briefcase className="h-3.5 w-3.5" />Travel & Identity Documents</CardTitle></CardHeader>
          <CardContent className="p-0">
            {renderDocTable(travelDocs, "No travel or identity documents on file")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 pb-1"><CardTitle className="text-sm flex items-center gap-2"><Plus className="h-3.5 w-3.5" />Medical Documents</CardTitle></CardHeader>
          <CardContent className="p-0">
            {renderDocTable(medicalDocs, "No medical documents on file")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 pb-1"><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-3.5 w-3.5" />Professional Certifications</CardTitle></CardHeader>
          <CardContent className="p-0">
            {renderDocTable(professionalDocs, "No professional certifications on file")}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{isEditing ? "Edit Document" : "Add Document"}</DialogTitle><DialogDescription>{isEditing ? `Update document details for ${crewName}` : `Add a new document for ${crewName}`}</DialogDescription></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="documentType" render={({ field }) => (<FormItem><FormLabel>Document Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-doc-type"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{DOCUMENT_TYPES.map((type) => (<SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="documentNumber" render={({ field }) => (<FormItem><FormLabel>Document Number</FormLabel><FormControl><Input {...field} placeholder="e.g., AB1234567" data-testid="input-doc-number" /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="issuedAt" render={({ field }) => (<FormItem><FormLabel>Issue Date</FormLabel><FormControl><Input type="date" {...field} data-testid="input-doc-issued" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="expiresAt" render={({ field }) => (<FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" {...field} data-testid="input-doc-expires" /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="issuingCountry" render={({ field }) => (<FormItem><FormLabel>Issuing Country</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-doc-country"><SelectValue placeholder="Select country" /></SelectTrigger></FormControl><SelectContent>{COMMON_COUNTRIES.map((country) => (<SelectItem key={country} value={country}>{country}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="issuingAuthority" render={({ field }) => (<FormItem><FormLabel>Issuing Authority</FormLabel><FormControl><Input {...field} placeholder="e.g., Maritime Authority" data-testid="input-doc-authority" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea {...field} placeholder="Additional notes about this document" className="min-h-[60px]" data-testid="input-doc-notes" /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter><Button type="button" variant="outline" onClick={handleCloseForm} data-testid="button-cancel-doc-form">Cancel</Button><Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-doc-form">{createMutation.isPending || updateMutation.isPending ? "Saving..." : isEditing ? "Update Document" : "Add Document"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Document</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this {getDocumentTypeLabel(selectedDoc?.documentType || "")}? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel data-testid="button-cancel-delete-doc">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => selectedDoc && deleteMutation.mutate(selectedDoc.id)} className="bg-red-500 hover:bg-red-600" data-testid="button-confirm-delete-doc">{deleteMutation.isPending ? "Deleting..." : "Delete"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  );
}
