import { ShieldX, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useLocation } from "wouter";

interface PermissionDeniedProps {
  resource?: string;
  action?: string;
  message?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
}

export function PermissionDenied({
  resource,
  action,
  message,
  showBackButton = true,
  showHomeButton = true,
}: PermissionDeniedProps) {
  const [, setLocation] = useLocation();

  const defaultMessage = resource && action
    ? `You don't have permission to ${action} ${resource.replace(/_/g, " ")}.`
    : "You don't have permission to access this resource.";

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            {message || defaultMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground text-center mb-4">
            Contact your administrator if you believe you should have access to this resource.
          </p>
          <div className="flex gap-2 justify-center">
            {showBackButton && (
              <Button
                variant="outline"
                onClick={() => globalThis.history.back()}
                data-testid="button-go-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            )}
            {showHomeButton && (
              <Link href="/">
                <Button data-testid="button-go-home">
                  <Home className="h-4 w-4 mr-2" />
                  Home
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PermissionDeniedInline({
  resource,
  action,
  message,
}: Omit<PermissionDeniedProps, "showBackButton" | "showHomeButton">) {
  const defaultMessage = resource && action
    ? `Permission required: ${action} on ${resource.replace(/_/g, " ")}`
    : "You don't have permission to view this content.";

  return (
    <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-muted-foreground text-sm">
      <ShieldX className="h-4 w-4 shrink-0" />
      <span>{message || defaultMessage}</span>
    </div>
  );
}
