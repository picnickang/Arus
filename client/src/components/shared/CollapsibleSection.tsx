import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  description?: string | undefined;
  badge?: string | undefined;
  summary?: string | undefined;
  children: React.ReactNode;
  defaultExpanded?: boolean | undefined;
  icon?: React.ReactNode | undefined;
}

export function CollapsibleSection({
  title,
  description,
  badge,
  summary,
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
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
                {badge && (
                  <Badge
                    variant="secondary"
                    className="text-xs"
                    data-testid={`badge-section-${title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {badge}
                  </Badge>
                )}
              </div>
              {(description || summary) && (
                <CardDescription className="text-xs sm:text-sm mt-1">
                  {description || summary}
                </CardDescription>
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
