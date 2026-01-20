import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StatusBadge, StatusType } from "@/components/ml-ai/utils/StatusBadge";
import { cn } from "@/lib/utils";
import { LucideIcon, ChevronDown, Check } from "lucide-react";
import { useState } from "react";

interface InsightCardProps {
  title: string;
  description: string;
  bullets: string[];
  status: StatusType;
  icon: LucideIcon;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  className?: string;
  'data-testid'?: string;
}

export function InsightCard({
  title,
  description,
  bullets,
  status,
  icon: Icon,
  defaultOpen = false,
  actions,
  className,
  'data-testid': testId,
}: InsightCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={cn("overflow-hidden", className)} data-testid={testId}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-muted flex-shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-sm md:text-base truncate" data-testid={`${testId}-title`}>
                    {title}
                  </h3>
                  <StatusBadge status={status} size="sm" />
                </div>
                
                <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`${testId}-description`}>
                  {description}
                </p>
              </div>
            </div>
            
            <CollapsibleTrigger asChild>
              <button
                className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                data-testid={`${testId}-toggle`}
              >
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </div>
          
          {/* Collapsible Content */}
          <CollapsibleContent className="space-y-3">
            {bullets.length > 0 && (
              <ul className="space-y-2 ml-2" data-testid={`${testId}-bullets`}>
                {bullets.map((bullet, index) => (
                  <li key={`bullet-${bullet.slice(0, 30)}-${index}`} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
            
            {actions && (
              <div className="pt-2 border-t" data-testid={`${testId}-actions`}>
                {actions}
              </div>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>
    </Card>
  );
}
