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

  const getEquipmentName = (equipmentId: string): string => {
    const healthItem = equipmentHealth?.find((eq) => eq.id === equipmentId);
    if (healthItem?.name) {return healthItem.name;}
    const eq = equipment?.find((e) => e.id === equipmentId);
    if (eq?.name) {return eq.name;}
    return equipmentId;
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
            {getEquipmentName(eq.id)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
