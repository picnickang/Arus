import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Mail,
  Phone,
  Star,
  Clock,
  Edit,
  Trash2,
  ShoppingCart,
  Wrench,
  MapPin,
  Award,
} from "lucide-react";
import type { SupplierWithStats, VendorType } from "../types";

interface SupplierCardProps {
  supplier: SupplierWithStats;
  onEdit?: (supplier: SupplierWithStats) => void;
  onDelete?: (supplier: SupplierWithStats) => void;
}

function getTypeBadge(type: VendorType) {
  switch (type) {
    case "supplier":
      return <Badge variant="secondary">Supplier</Badge>;
    case "service_provider":
      return (
        <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">
          Service Provider
        </Badge>
      );
    case "both":
      return (
        <Badge variant="outline" className="border-purple-500 text-purple-600 dark:text-purple-400">
          Supplier & Service
        </Badge>
      );
    default:
      return null;
  }
}

export function SupplierCard({ supplier, onEdit, onDelete }: SupplierCardProps) {
  const isServiceProvider = supplier.type === "service_provider" || supplier.type === "both";
  const isSupplier = supplier.type === "supplier" || supplier.type === "both";

  return (
    <Card
      className="hover:shadow-md transition-shadow"
      data-testid={`supplier-card-${supplier.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isServiceProvider ? (
              <Wrench className="h-5 w-5 text-muted-foreground shrink-0" />
            ) : (
              <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <CardTitle className="text-lg truncate">{supplier.name}</CardTitle>
          </div>
          <div className="flex gap-1 flex-wrap justify-end shrink-0">
            {supplier.isPreferred && (
              <Badge variant="default" className="bg-amber-500">
                <Star className="h-3 w-3 mr-1" />
                Preferred
              </Badge>
            )}
            <Badge variant={supplier.isActive ? "default" : "secondary"}>
              {supplier.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Code: {supplier.code}</span>
          {getTypeBadge(supplier.type)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {supplier.contactName && (
          <div className="text-sm">
            <span className="font-medium">Contact:</span> {supplier.contactName}
          </div>
        )}
        {supplier.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline truncate">
              {supplier.email}
            </a>
          </div>
        )}
        {supplier.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{supplier.phone}</span>
          </div>
        )}
        {supplier.address && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{supplier.address}</span>
          </div>
        )}

        {isSupplier && (
          <div className="flex items-center gap-4 text-sm flex-wrap">
            {supplier.leadTimeDays != null && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{supplier.leadTimeDays}d lead</span>
              </div>
            )}
            {supplier.qualityRating != null && (
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-amber-500" />
                <span>{supplier.qualityRating.toFixed(1)}/10</span>
              </div>
            )}
          </div>
        )}

        {isServiceProvider && (
          <div className="space-y-1 text-sm">
            {supplier.responseSlaHours != null && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{supplier.responseSlaHours}h SLA</span>
              </div>
            )}
            {supplier.certifications && supplier.certifications.length > 0 && (
              <div className="flex items-center gap-1">
                <Award className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">
                  {supplier.certifications.slice(0, 2).join(", ")}
                  {supplier.certifications.length > 2
                    ? ` +${supplier.certifications.length - 2}`
                    : ""}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShoppingCart className="h-4 w-4" />
          <span>{supplier.orderCount} orders</span>
        </div>

        {(onEdit || onDelete) && (
          <div className="flex gap-2 pt-2 border-t">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(supplier)}
                data-testid={`edit-supplier-${supplier.id}`}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(supplier)}
                className="text-destructive"
                data-testid={`delete-supplier-${supplier.id}`}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
