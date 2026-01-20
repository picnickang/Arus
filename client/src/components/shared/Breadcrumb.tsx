import { ChevronRight, Home } from "lucide-react";
import { Link } from "wouter";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      className="flex items-center space-x-2 text-sm text-muted-foreground mb-4"
      aria-label="Breadcrumb"
    >
      <Link
        href="/"
        className="flex items-center hover:text-foreground transition-colors"
        aria-label="Home"
        data-testid="breadcrumb-home"
      >
        <Home className="h-4 w-4" />
      </Link>

      {items.map((item, index) => (
        <div key={`${item.label}-${item.href || index}`} className="flex items-center space-x-2">
          <ChevronRight className="h-4 w-4" />
          {item.href && index < items.length - 1 ? (
            <Link
              href={item.href}
              className="hover:text-foreground transition-colors"
              data-testid={`breadcrumb-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {item.label}
            </Link>
          ) : (
            <span
              className="text-foreground font-medium"
              data-testid={`breadcrumb-current-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
