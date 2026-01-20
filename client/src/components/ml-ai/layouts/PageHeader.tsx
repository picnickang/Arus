import { LucideIcon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  className?: string;
  'data-testid'?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  breadcrumbs,
  className,
  'data-testid': testId,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-4", className)} data-testid={testId}>
      {breadcrumbs?.length > 0 && (
        <nav className="flex items-center gap-2 text-sm text-muted-foreground" data-testid={`${testId}-breadcrumbs`}>
          {breadcrumbs.map((crumb, index) => (
            <div key={`${crumb.label}-${crumb.href || index}`} className="flex items-center gap-2">
              {crumb.href ? (
                <Link href={crumb.href}>
                  <a className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </a>
                </Link>
              ) : (
                <span className={index === breadcrumbs.length - 1 ? "text-foreground font-medium" : ""}>
                  {crumb.label}
                </span>
              )}
              {index < breadcrumbs.length - 1 && (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          ))}
        </nav>
      )}
      
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="h-6 w-6 text-primary" data-testid={`${testId}-icon`} />
              </div>
            )}
            <h1 
              className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight" 
              data-testid={`${testId}-title`}
            >
              {title}
            </h1>
          </div>
          
          {description && (
            <p 
              className="text-sm md:text-base text-muted-foreground max-w-3xl" 
              data-testid={`${testId}-description`}
            >
              {description}
            </p>
          )}
        </div>
        
        {actions && (
          <div className="flex items-center gap-2" data-testid={`${testId}-actions`}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
