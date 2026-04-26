import { FormEvent, ReactNode, useState } from "react";
import { Lock, ShipWheel } from "lucide-react";
import { useAdminAccess } from "@/contexts/AdminAccessContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SessionGate({ children }: { children: ReactNode }) {
  const { isAdminUnlocked, unlockAdmin, isUnlocking, unlockError } = useAdminAccess();
  const [password, setPassword] = useState("");

  if (import.meta.env.DEV || isAdminUnlocked) {
    return <>{children}</>;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await unlockAdmin(password);
    setPassword("");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShipWheel className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Unlock ARUS</CardTitle>
          <CardDescription>
            Enter the vessel admin password to start an authenticated operations session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="arus-session-password">Admin password</Label>
              <Input
                id="arus-session-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                disabled={isUnlocking}
                autoFocus
              />
            </div>

            {unlockError && (
              <p className="text-sm text-destructive" role="alert">
                {unlockError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isUnlocking || !password.trim()}>
              <Lock className="h-4 w-4" />
              {isUnlocking ? "Unlocking..." : "Unlock session"}
            </Button>

            <p className="text-xs text-muted-foreground">
              Session tokens are kept in memory only. Reloading the app requires unlocking again.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
