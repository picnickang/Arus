import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, ExternalLink, Wrench } from "lucide-react";
import { SO_STATUS_COLORS } from "@/features/serviceOrders/types";

export function ServiceRequestsPanel() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data: serviceOrders = [], isLoading } = useQuery<{ id: string; soNumber?: string; serviceProviderName?: string; scope?: string; status?: string }[]>({
    queryKey: ["/api/service-orders", { status: "confirmed" }],
  });

  const filteredOrders = serviceOrders.filter((so) => {
    if (!search) {return true;}
    const searchLower = search.toLowerCase();
    return so.soNumber?.toLowerCase().includes(searchLower) ||
      so.serviceProviderName?.toLowerCase().includes(searchLower) ||
      so.scope?.toLowerCase().includes(searchLower);
  });

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wrench className="h-5 w-5" /> Service Orders
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Confirmed service orders ready for execution
            </CardDescription>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-8 h-8" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-so" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No confirmed service orders</p>
            <p className="text-xs mt-2">Service orders appear here once confirmed from Work Orders</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SO #</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((so) => (
                <TableRow key={so.id} data-testid={`row-so-${so.id}`}>
                  <TableCell className="font-medium">{so.soNumber}</TableCell>
                  <TableCell className="truncate max-w-[120px]">{so.serviceProviderName || "—"}</TableCell>
                  <TableCell>
                    <Badge className={SO_STATUS_COLORS[so.status] || "bg-gray-100"}>{so.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setLocation(`/service-orders/${so.id}`)} data-testid={`btn-view-so-${so.id}`}>
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

export default ServiceRequestsPanel;
