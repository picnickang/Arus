import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, Check, Clock, FileText, FileWarning, RefreshCw } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useDocumentExpiryData, type ExpiringDocument } from "@/features/crew/hooks/useDocumentExpiryData";

function getUrgencyIcon(level: string) {
  switch (level) {
    case "critical": return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "warning": return <AlertCircle className="h-4 w-4 text-amber-500" />;
    default: return <Info className="h-4 w-4 text-blue-500" />;
  }
}

function getUrgencyBadge(level: string) {
  switch (level) {
    case "critical": return <Badge variant="destructive" className="text-xs">Critical</Badge>;
    case "warning": return <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 dark:text-amber-400">Warning</Badge>;
    default: return <Badge variant="secondary" className="text-xs">Notice</Badge>;
  }
}

function DocumentRow({ doc, onAcknowledge, onMarkRenewed, getDocumentTypeLabel }: { doc: ExpiringDocument; onAcknowledge: (doc: ExpiringDocument) => void; onMarkRenewed: (doc: ExpiringDocument) => void; getDocumentTypeLabel: (type: string) => string }) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border ${
        doc.alertAcknowledged ? "bg-muted/50 border-muted" :
        doc.urgencyLevel === "critical" ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" :
        doc.urgencyLevel === "warning" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" :
        "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
      }`}
      data-testid={`doc-alert-${doc.id}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 shrink-0">{getUrgencyIcon(doc.urgencyLevel)}</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm" data-testid={`text-doc-crew-name-${doc.id}`}>{doc.crewMemberName}</span>
            <span className="text-xs text-muted-foreground">({doc.crewMemberRank})</span>
            {getUrgencyBadge(doc.urgencyLevel)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-medium">{getDocumentTypeLabel(doc.documentType)}</span>
            {doc.documentNumber && <span>#{doc.documentNumber}</span>}
            {doc.issuingCountry && <span>({doc.issuingCountry})</span>}
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {doc.daysUntilExpiry <= 0 ? "Expired" : doc.daysUntilExpiry === 1 ? "Expires tomorrow" : `Expires in ${doc.daysUntilExpiry} days`}
            </span>
            <span className="text-muted-foreground">({format(new Date(doc.expiresAt), "MMM d, yyyy")})</span>
          </div>
          {doc.alertAcknowledged && doc.alertAcknowledgedAt && (
            <div className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
              <Check className="h-3 w-3" />
              Acknowledged {formatDistanceToNow(new Date(doc.alertAcknowledgedAt), { addSuffix: true })}
              {doc.alertAcknowledgedNotes && <span className="ml-1 text-muted-foreground">- {doc.alertAcknowledgedNotes}</span>}
            </div>
          )}
        </div>
      </div>
      {!doc.alertAcknowledged && (
        <div className="flex gap-2 shrink-0 self-end sm:self-center">
          <Button variant="outline" size="sm" onClick={() => onAcknowledge(doc)} data-testid={`button-acknowledge-doc-${doc.id}`}>
            <Check className="h-3 w-3 mr-1" />Acknowledge
          </Button>
          <Button variant="default" size="sm" onClick={() => onMarkRenewed(doc)} data-testid={`button-renew-doc-${doc.id}`}>
            <RefreshCw className="h-3 w-3 mr-1" />Mark as Renewed
          </Button>
        </div>
      )}
    </div>
  );
}

export function DocumentExpiryAlertBanner() {
  const {
    data, isLoading, error, isExpanded, setIsExpanded, acknowledgeDialogOpen, setAcknowledgeDialogOpen,
    selectedDoc, acknowledgeNotes, setAcknowledgeNotes, handleAcknowledge, confirmAcknowledge, isAcknowledging,
    criticalCount, warningCount, getDocumentTypeLabel,
  } = useDocumentExpiryData();

  if (isLoading) {
    return (
      <Card className="mb-4"><CardHeader className="py-3"><Skeleton className="h-6 w-48" /></CardHeader><CardContent className="py-2"><Skeleton className="h-4 w-full" /></CardContent></Card>
    );
  }

  if (error || !data) {return null;}

  const { documents, summary } = data;
  if (summary.total === 0) {return null;}

  const alertVariant = criticalCount > 0 ? "destructive" : "default";

  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="mb-4">
        <Alert variant={alertVariant} className="border-l-4 border-l-orange-500">
          <FileText className="h-5 w-5" />
          <div className="flex-1">
            <AlertTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                Crew Document Expiry Alerts
                <div className="flex gap-1 ml-2">
                  {criticalCount > 0 && <Badge variant="destructive" className="text-xs" data-testid="badge-doc-critical-count">{criticalCount} Critical</Badge>}
                  {warningCount > 0 && <Badge variant="outline" className="text-xs border-amber-500 text-amber-600" data-testid="badge-doc-warning-count">{warningCount} Warning</Badge>}
                </div>
              </span>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid="button-toggle-doc-alerts">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </AlertTitle>
            <AlertDescription className="mt-1 text-sm">
              {summary.total} crew document{summary.total !== 1 ? "s" : ""} expiring within 90 days. Review and ensure timely renewal for continued compliance with maritime regulations.
            </AlertDescription>
          </div>
        </Alert>

        <CollapsibleContent className="mt-2">
          <Card>
            <CardHeader className="py-3 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4" />Expiring Documents ({summary.total})</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="space-y-2">
                {documents.map((doc) => <DocumentRow key={doc.id} doc={doc} onAcknowledge={handleAcknowledge} onMarkRenewed={(d) => { setAcknowledgeNotes("Document renewed"); handleAcknowledge(d); }} getDocumentTypeLabel={getDocumentTypeLabel} />)}
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={acknowledgeDialogOpen} onOpenChange={setAcknowledgeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge Document Alert</DialogTitle>
            <DialogDescription>
              Acknowledge that you are aware of the upcoming document expiry for {selectedDoc?.crewMemberName}'s {getDocumentTypeLabel(selectedDoc?.documentType || "")}.
              This does not resolve the issue - ensure renewal actions are taken.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea placeholder="Add notes about actions being taken (optional)" value={acknowledgeNotes} onChange={(e) => setAcknowledgeNotes(e.target.value)} className="min-h-[80px]" data-testid="input-doc-acknowledge-notes" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcknowledgeDialogOpen(false)} data-testid="button-cancel-doc-acknowledge">Cancel</Button>
            <Button onClick={confirmAcknowledge} disabled={isAcknowledging} data-testid="button-confirm-doc-acknowledge">{isAcknowledging ? "Acknowledging..." : "Acknowledge Alert"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DocumentExpiryWidget() {
  const { data, isLoading } = useDocumentExpiryData();

  if (isLoading) {
    return <Card><CardContent className="pt-6"><Skeleton className="h-12 w-full" /></CardContent></Card>;
  }

  if (!data || data.summary.total === 0) {
    return <Card><CardContent className="pt-6"><div className="flex items-center gap-3 text-green-600"><Check className="h-5 w-5" /><span className="text-sm">All crew documents are current</span></div></CardContent></Card>;
  }

  const { summary } = data;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileWarning className="h-4 w-4" />Document Alerts</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30" data-testid="doc-widget-critical"><div className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.critical}</div><div className="text-xs text-muted-foreground">Critical</div></div>
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30" data-testid="doc-widget-warning"><div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.warning}</div><div className="text-xs text-muted-foreground">Warning</div></div>
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30" data-testid="doc-widget-notice"><div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.notice}</div><div className="text-xs text-muted-foreground">Notice</div></div>
        </div>
      </CardContent>
    </Card>
  );
}
