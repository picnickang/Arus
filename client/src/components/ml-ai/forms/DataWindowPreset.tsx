import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, Crown, Award, Medal, Trophy } from "lucide-react";

export type DataWindowTier = 'bronze' | 'silver' | 'gold' | 'platinum';

interface DataWindowPresetProps {
  tier: DataWindowTier;
  days: number;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  'data-testid'?: string;
}

const tierConfig = {
  bronze: {
    icon: Medal,
    color: 'from-orange-600 to-orange-400',
    borderColor: 'border-orange-500',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-600',
  },
  silver: {
    icon: Award,
    color: 'from-gray-400 to-gray-300',
    borderColor: 'border-gray-400',
    bgColor: 'bg-gray-400/10',
    textColor: 'text-gray-600',
  },
  gold: {
    icon: Trophy,
    color: 'from-yellow-500 to-yellow-300',
    borderColor: 'border-yellow-500',
    bgColor: 'bg-yellow-500/10',
    textColor: 'text-yellow-600',
  },
  platinum: {
    icon: Crown,
    color: 'from-purple-500 to-purple-300',
    borderColor: 'border-purple-500',
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-600',
  },
};

export function DataWindowPreset({
  tier,
  days,
  label,
  description,
  selected,
  onClick,
  disabled = false,
  className,
  'data-testid': testId,
}: DataWindowPresetProps) {
  const config = tierConfig[tier];
  const Icon = config.icon;

  return (
    <Card
      className={cn(
        "relative cursor-pointer transition-all hover:shadow-md flex-shrink-0 min-w-[150px] snap-start md:min-w-0",
        selected && `ring-2 ${config.borderColor}`,
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onClick={disabled ? undefined : onClick}
      data-testid={testId || `preset-${tier}`}
    >
      {selected && (
        <div className={cn("absolute top-2 right-2 p-1 rounded-full bg-background border-2", config.borderColor)}>
          <Check className={cn("h-3 w-3", config.textColor)} />
        </div>
      )}
      
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", config.bgColor)}>
            <Icon className={cn("h-5 w-5", config.textColor)} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className={cn("text-sm font-bold uppercase tracking-wide", config.textColor)}>
              {label}
            </div>
            <div className="text-xs text-muted-foreground">
              {days} days
            </div>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground line-clamp-2">
          {description}
        </p>
      </div>
    </Card>
  );
}
