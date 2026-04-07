import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface Equipment {
  id: string;
  name?: string;
  type?: string;
  vesselId?: string;
}
interface EquipmentHealthItem { id: string; name?: string; }
interface Vessel { id: string; name: string; }

interface EquipmentSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  "data-testid"?: string;
  vesselId?: string;
  filterByVessel?: boolean;
}

export function EquipmentSelector({
  value,
  onValueChange,
  placeholder = "Select equipment",
  disabled = false,
  "data-testid": testId = "select-equipment",
  vesselId,
  filterByVessel = false,
}: EquipmentSelectorProps) {
  const { data: equipment = [], isLoading } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: equipmentHealth = [] } = useQuery<EquipmentHealthItem[]>({
    queryKey: ["/api/equipment/health"],
  });

  const { data: vessels = [] } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
  });

  const getVesselName = (vId?: string): string | null => {
    if (!vId) return null;
    const v = vessels?.find((vessel) => vessel.id === vId);
    return v?.name || null;
  };

  const getEquipmentLabel = (eq: Equipment): string => {
    const healthItem = equipmentHealth?.find((h) => h.id === eq.id);
    const name = healthItem?.name || eq.name || eq.id;
    const vesselName = getVesselName(eq.vesselId);
    return vesselName ? `${name} — ${vesselName}` : name;
  };

  const filteredEquipment =
    filterByVessel && vesselId
      ? equipment.filter((eq) => eq.vesselId === vesselId)
      : equipment;

  const validEquipment = filteredEquipment.filter((eq) => eq.id && eq.id.trim() !== "");

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger data-testid={testId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {validEquipment.map((eq) => (
          <SelectItem key={eq.id} value={eq.id}>
            {getEquipmentLabel(eq)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
