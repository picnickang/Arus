import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";

export function CertStatusBadge({
  equipmentId,
  allCerts,
}: {
  equipmentId: string;
  allCerts: Array<{
    equipmentId?: string | null;
    status?: string;
    expiryDate?: string | Date | null;
  }>;
}) {
  const eqCerts = allCerts.filter((c) => c.equipmentId === equipmentId);
  if (eqCerts.length === 0) {
    return (
      <Badge variant="outline" className="text-muted-foreground text-xs">
        <Shield className="h-3 w-3 mr-1" />
        No certs
      </Badge>
    );
  }
  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const nonValidStatuses = ["expired", "suspended", "withdrawn"];
  const hasNonValid = eqCerts.some(
    (c) =>
      nonValidStatuses.includes(c.status || "") || (c.expiryDate && new Date(c.expiryDate) <= now)
  );
  const hasPendingRenewal = eqCerts.some((c) => c.status === "pending_renewal");
  const hasExpiring = eqCerts.some(
    (c) => c.expiryDate && new Date(c.expiryDate) > now && new Date(c.expiryDate) <= in90
  );
  if (hasNonValid) {
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">
        <Shield className="h-3 w-3 mr-1" />
        Non-compliant
      </Badge>
    );
  }
  if (hasPendingRenewal || hasExpiring) {
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
        <Shield className="h-3 w-3 mr-1" />
        Expiring
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
      <Shield className="h-3 w-3 mr-1" />
      Current
    </Badge>
  );
}
