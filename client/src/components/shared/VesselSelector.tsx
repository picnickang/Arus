import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface Vessel {
  id: string;
  name: string;
}

interface VesselSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  "data-testid"?: string;
  allowEmpty?: boolean;
}

export function VesselSelector({
  value,
  onValueChange,
  placeholder = "Select vessel",
  disabled = false,
  "data-testid": testId = "select-vessel",
  allowEmpty = false,
}: VesselSelectorProps) {
  const { data: vessels = [], isLoading } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
  });

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger data-testid={testId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value="__none__">No vessel</SelectItem>}
        {vessels.filter(v => v.id).map((vessel) => (
          <SelectItem key={vessel.id} value={vessel.id}>
            {vessel.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
