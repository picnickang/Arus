import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { QrCode, Search, Wrench, ClipboardCheck, PackageSearch, Activity } from "lucide-react";
import { PageHeader } from "@/components/navigation/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEquipmentList } from "@/features/vessels";

interface EquipmentLike {
  id: string;
  name?: string;
  tagNumber?: string | null;
  assetTag?: string | null;
  serialNumber?: string | null;
  type?: string | null;
  category?: string | null;
  vesselId?: string | null;
}

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function matchesCode(item: EquipmentLike, code: string): boolean {
  const target = normalize(code);
  if (!target) return false;
  return [item.id, item.name, item.tagNumber, item.assetTag, item.serialNumber]
    .map(normalize)
    .some((candidate) => candidate === target || candidate.includes(target));
}

export default function EquipmentScanPage() {
  const [location, setLocation] = useLocation();
  const params = useMemo(() => new URLSearchParams(location.split("?")[1] || ""), [location]);
  const initialCode = params.get("code") || params.get("asset") || params.get("equipmentId") || "";
  const [code, setCode] = useState(initialCode);
  const { data: equipment = [], isLoading } = useEquipmentList();

  const matches = useMemo(
    () => (equipment as EquipmentLike[]).filter((item) => matchesCode(item, code)).slice(0, 12),
    [equipment, code]
  );

  useEffect(() => {
    if (initialCode && matches.length === 1) {
      setLocation(`/equipment/${matches[0].id}`);
    }
  }, [initialCode, matches, setLocation]);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <PageHeader title="Scan Equipment" subtitle="Enter a QR code, asset tag, serial number, or equipment name." />
      <div className="space-y-6 px-4 pt-2 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Equipment entry point
            </CardTitle>
            <CardDescription>
              QR labels should encode either /equipment-scan?equipmentId=&lt;id&gt; or /equipment-scan?code=&lt;asset-tag&gt;.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-2xl">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Scan or type equipment ID, asset tag, serial number, or name"
                className="pl-9"
                autoFocus
                data-testid="input-equipment-scan-code"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <Button onClick={() => matches[0] && setLocation(`/equipment/${matches[0].id}`)} disabled={matches.length !== 1}>
                Open equipment
              </Button>
              <Button variant="outline" onClick={() => matches[0] && setLocation(`/maint?tab=work-orders&action=create&equipmentId=${matches[0].id}`)} disabled={matches.length !== 1}>
                <Wrench className="h-4 w-4" />
                Create defect
              </Button>
              <Button variant="outline" onClick={() => matches[0] && setLocation(`/pdm/equipment/${matches[0].id}`)} disabled={matches.length !== 1}>
                <Activity className="h-4 w-4" />
                PdM detail
              </Button>
              <Button variant="outline" asChild>
                <Link href="/maint?tab=equipment-intelligence">
                  <PackageSearch className="h-4 w-4" />
                  Equipment list
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matched equipment</CardTitle>
            <CardDescription>{isLoading ? "Loading equipment..." : `${matches.length} match(es)`}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!code && (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Scan or type a code to jump straight to equipment health, open work, parts, manuals, logs, and PdM actions.
              </div>
            )}
            {code && !isLoading && matches.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No equipment matched this code. Check the label or open the equipment list.
              </div>
            )}
            {matches.map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{item.type || item.category || "Equipment"}</Badge>
                      {item.assetTag && <Badge variant="outline">Asset {item.assetTag}</Badge>}
                      {item.serialNumber && <Badge variant="outline">Serial {item.serialNumber}</Badge>}
                    </div>
                    <h3 className="mt-2 font-semibold">{item.name || item.id}</h3>
                    <p className="text-xs text-muted-foreground">ID: {item.id}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setLocation(`/equipment/${item.id}`)}>
                      Open
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setLocation(`/maint?tab=work-orders&action=create&equipmentId=${item.id}`)}>
                      <ClipboardCheck className="h-4 w-4" />
                      Work order
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setLocation(`/pdm/equipment/${item.id}`)}>
                      PdM
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
