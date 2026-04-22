import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function RecommendedActionsChecklist({ actions }: { actions: string[] }) {
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const toggleItem = (index: number) => {
    setCheckedItems((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const completedCount = Object.values(checkedItems).filter(Boolean).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">Recommended Actions</p>
        <Badge variant="outline" className="text-xs">
          {completedCount}/{actions.length} completed
        </Badge>
      </div>
      <ul className="space-y-2">
        {actions.map((action, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 text-sm p-2 rounded cursor-pointer hover-elevate ${
              checkedItems[i] ? "bg-green-100 dark:bg-green-900/30" : "bg-muted/30"
            }`}
            onClick={() => toggleItem(i)}
            data-testid={`action-item-${i}`}
          >
            <div
              className={`h-4 w-4 mt-0.5 shrink-0 rounded border flex items-center justify-center ${
                checkedItems[i]
                  ? "bg-green-500 border-green-500 text-white"
                  : "border-muted-foreground"
              }`}
            >
              {checkedItems[i] && <CheckCircle className="h-3 w-3" />}
            </div>
            <span className={checkedItems[i] ? "line-through text-muted-foreground" : ""}>
              {action}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
