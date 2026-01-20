import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  icon?: React.ReactNode;
}

export function CollapsibleSection({
  title,
  description,
  children,
  defaultExpanded = false,
  icon,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && <div className="text-muted-foreground">{icon}</div>}
            <div>
              <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
              {description && (
                <CardDescription className="text-xs sm:text-sm mt-1">{description}</CardDescription>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
            aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
            aria-expanded={isExpanded}
            data-testid={`collapse-${title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className={cn("pt-0 transition-all duration-200 ease-in-out")}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}
