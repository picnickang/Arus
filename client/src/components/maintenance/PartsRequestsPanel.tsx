import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ExternalLink, Loader2, Package } from "lucide-react";
import { usePurchaseRequests } from "@/features/purchaseRequests/hooks/usePurchaseRequests";
import { PRStatusBadge } from "@/features/purchaseRequests";

export function PartsRequestsPanel() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data: requests = [], isLoading } = usePurchaseRequests({ status: "sent" });

  const filteredRequests = requests.filter((pr) => {
    if (!search) {return true;}
    const searchLower = search.toLowerCase();
    return pr.prNumber?.toLowerCase().includes(searchLower) || 
      pr.requestedBy?.toLowerCase().includes(searchLower);
  });

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" /> Purchase Orders
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Confirmed purchase requests ready for procurement
            </CardDescription>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-8 h-8" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-pr" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No confirmed purchase orders</p>
            <p className="text-xs mt-2">Purchase orders appear here once confirmed from Work Orders</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>PR #</TableHead><TableHead>Requested By</TableHead><TableHead>Status</TableHead><TableHead className="w-12"></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((pr) => (
                <TableRow key={pr.id} data-testid={`row-pr-${pr.id}`}>
                  <TableCell className="font-medium">{pr.prNumber}</TableCell>
                  <TableCell className="truncate max-w-[120px]">{pr.requestedBy}</TableCell>
                  <TableCell><PRStatusBadge status={pr.status} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setLocation(`/purchase-requests/${pr.id}`)} data-testid={`btn-view-pr-${pr.id}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default PartsRequestsPanel;
