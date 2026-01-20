import { Link, useLocation } from "wouter";
import { Home, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
}

export function PageHeader({ title, showBack = true }: PageHeaderProps) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              data-testid="button-home"
            >
              <Home className="h-5 w-5" />
              <span className="sr-only">Home</span>
            </Button>
          </Link>
          
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={handleBack}
              data-testid="button-back"
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </Button>
          )}
        </div>

        <h1 className="flex-1 text-lg font-semibold truncate" data-testid="text-page-title">
          {title}
        </h1>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
