import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

interface BadgeMeta {
  color: string;
  iconName: "loader" | "check" | "x";
}

export function StatusBadge({
  status,
  getBadgeMeta,
}: {
  status: string;
  getBadgeMeta: (s: string) => BadgeMeta;
}) {
  const v = getBadgeMeta(status);
  const icons = {
    loader: <Loader2 className="h-3 w-3 animate-spin" />,
    check: <CheckCircle className="h-3 w-3" />,
    x: <XCircle className="h-3 w-3" />,
  };
  return (
    <Badge className={`${v.color} text-white`}>
      {icons[v.iconName]}
      <span className="ml-1 capitalize">{status}</span>
    </Badge>
  );
}
