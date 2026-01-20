import { Link } from "wouter";
import { type LucideIcon, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface NavigationCardProps {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  className?: string;
  onAddToDock?: () => void;
  isInDock?: boolean;
}

export function NavigationCard({ name, href, icon: Icon, description, className, onAddToDock, isInDock }: NavigationCardProps) {
  const cardContent = (
    <div
      className={cn(
        "group flex flex-col items-center justify-center cursor-pointer",
        "transition-all duration-200 ease-out",
        "hover:scale-105 active:scale-95",
        className
      )}
      data-testid={`nav-card-${name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className={cn(
        "w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-2xl flex items-center justify-center",
        "bg-primary shadow-lg",
        "group-hover:shadow-xl group-hover:bg-primary/90",
        "transition-all duration-200"
      )}>
        <Icon className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 text-primary-foreground" strokeWidth={2} />
      </div>
      <span className="mt-2 text-xs sm:text-sm font-medium text-center text-foreground line-clamp-2 max-w-[80px] sm:max-w-[100px]">
        {name}
      </span>
    </div>
  );

  if (onAddToDock) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Link href={href}>
            {cardContent}
          </Link>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem 
            onClick={onAddToDock} 
            disabled={isInDock}
            data-testid={`menu-add-dock-${name.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {isInDock ? (
              <>
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Already in Dock
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add to Dock
              </>
            )}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return (
    <Link href={href}>
      {cardContent}
    </Link>
  );
}
