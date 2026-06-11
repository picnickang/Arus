import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  Camera,
  ClipboardCheck,
  Copy,
  PackageSearch,
  Printer,
  QrCode,
  Search,
  Wrench,
} from "lucide-react";
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
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function matchesCode(item: EquipmentLike, code: string): boolean {
  const target = normalize(code);
  if (!target) {
    return false;
  }
  return [item.id, item.name, item.tagNumber, item.assetTag, item.serialNumber]
    .map(normalize)
    .some((candidate) => candidate === target || candidate.includes(target));
}

export default function EquipmentScanPage() {
  const [location, setLocation] = useLocation();
  const params = useMemo(() => new URLSearchParams(location.split("?")[1] || ""), [location]);
  const initialCode = params.get("code") || params.get("asset") || params.get("equipmentId") || "";
  const [code, setCode] = useState(initialCode);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [isCameraScanning, setIsCameraScanning] = useState(false);
  const { data: equipment = [], isLoading } = useEquipmentList();

  const matches = useMemo(
    () => (equipment as EquipmentLike[]).filter((item) => matchesCode(item, code)).slice(0, 12),
    [equipment, code]
  );
  const selectedEquipment = matches.length === 1 ? matches[0] : null;
  const selectedQrPayload = selectedEquipment
    ? `/equipment-scan?equipmentId=${encodeURIComponent(selectedEquipment.id)}`
    : "";

  const copyQrPayload = async () => {
    if (!selectedQrPayload) {
      return;
    }
    await navigator.clipboard?.writeText(selectedQrPayload);
    setScanMessage("QR payload copied for label printing.");
  };

  const printLabel = () => {
    if (!selectedEquipment) {
      return;
    }
    const labelWindow = window.open("", "_blank", "width=420,height=520");
    if (!labelWindow) {
      setScanMessage("Popup blocked. Allow popups to print labels.");
      return;
    }
    labelWindow.document.write(`
      <html><head><title>Equipment Label</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}.label{border:2px solid #111;padding:16px;width:320px}.code{font-family:monospace;word-break:break-all;font-size:12px}.name{font-size:20px;font-weight:700}</style>
      </head><body>
      <div class="label">
        <div class="name">${selectedEquipment.name || selectedEquipment.id}</div>
        <p>${selectedEquipment.type || selectedEquipment.category || "Equipment"}</p>
        <p class="code">${selectedQrPayload}</p>
        <p>Scan this code in ARUS to open equipment, defects, checklists, parts, and PdM.</p>
      </div>
      </body></html>
    `);
    labelWindow.document.close();
    labelWindow.focus();
    labelWindow.print();
  };

  const startCameraScan = async () => {
    setIsCameraScanning(true);
    setScanMessage(null);
    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera scanning is not available in this browser.");
      }
      const BarcodeDetectorCtor = (
        window as object as {
          BarcodeDetector?: new (options?: unknown) => {
            detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
          };
        }
      ).BarcodeDetector;
      if (!BarcodeDetectorCtor) {
        throw new Error(
          "This device does not expose BarcodeDetector. Use a scanner wedge or type the asset tag."
        );
      }
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      const barcodes = await detector.detect(video);
      const rawValue = barcodes[0]?.rawValue;
      if (!rawValue) {
        throw new Error("No QR code detected. Try again closer to the label.");
      }
      const parsed = new URL(rawValue, window.location.origin);
      const scannedCode =
        parsed.searchParams.get("equipmentId") || parsed.searchParams.get("code") || rawValue;
      setCode(scannedCode);
      setScanMessage("QR code scanned.");
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : "Camera scan failed.");
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      setIsCameraScanning(false);
    }
  };

  useEffect(() => {
    if (initialCode && matches.length === 1 && matches[0]) {
      setLocation(`/equipment/${matches[0].id}`);
    }
  }, [initialCode, matches, setLocation]);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <PageHeader
        title="Scan Equipment"
        subtitle="Enter a QR code, asset tag, serial number, or equipment name."
      />
      <div className="space-y-6 px-4 pt-2 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Equipment entry point
            </CardTitle>
            <CardDescription>
              QR labels should encode either /equipment-scan?equipmentId=&lt;id&gt; or
              /equipment-scan?code=&lt;asset-tag&gt;.
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
            {scanMessage && <p className="text-sm text-muted-foreground">{scanMessage}</p>}
            <div className="grid gap-2 md:grid-cols-4">
              <Button
                onClick={() =>
                  selectedEquipment && setLocation(`/equipment/${selectedEquipment.id}`)
                }
                disabled={!selectedEquipment}
              >
                Open equipment
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  selectedEquipment &&
                  setLocation(`/work-orders?action=create&equipmentId=${selectedEquipment.id}`)
                }
                disabled={!selectedEquipment}
              >
                <Wrench className="h-4 w-4" />
                Create defect
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  selectedEquipment && setLocation(`/pdm/equipment/${selectedEquipment.id}`)
                }
                disabled={!selectedEquipment}
              >
                <Activity className="h-4 w-4" />
                PdM detail
              </Button>
              <Button variant="outline" asChild>
                <Link href="/equipment-intelligence">
                  <PackageSearch className="h-4 w-4" />
                  Equipment list
                </Link>
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <Button variant="outline" onClick={startCameraScan} disabled={isCameraScanning}>
                <Camera className="h-4 w-4" />
                {isCameraScanning ? "Scanning..." : "Camera scan"}
              </Button>
              <Button variant="outline" onClick={copyQrPayload} disabled={!selectedEquipment}>
                <Copy className="h-4 w-4" />
                Copy QR payload
              </Button>
              <Button variant="outline" onClick={printLabel} disabled={!selectedEquipment}>
                <Printer className="h-4 w-4" />
                Print label
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matched equipment</CardTitle>
            <CardDescription>
              {isLoading ? "Loading equipment..." : `${matches.length} match(es)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!code && (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Scan or type a code to jump straight to equipment health, open work, parts, manuals,
                logs, and PdM actions.
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
                      {item.serialNumber && (
                        <Badge variant="outline">Serial {item.serialNumber}</Badge>
                      )}
                    </div>
                    <h3 className="mt-2 font-semibold">{item.name || item.id}</h3>
                    <p className="text-xs text-muted-foreground">ID: {item.id}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setLocation(`/equipment/${item.id}`)}>
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setLocation(`/work-orders?action=create&equipmentId=${item.id}`)
                      }
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      Work order
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLocation(`/pdm/equipment/${item.id}`)}
                    >
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
