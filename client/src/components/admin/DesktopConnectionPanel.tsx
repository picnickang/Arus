import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Server, CheckCircle2, XCircle, Loader2, Info, AlertTriangle } from "lucide-react";
import { isDesktop } from "@/lib/desktop";
import { getBackendUrlSync, setBackendUrl, testBackendConnection } from "@/lib/desktopFetch";
import { validateBackendUrl } from "@/lib/urlValidation";
import { queryClient } from "@/lib/queryClient";

type TestStatus = "idle" | "testing" | "success" | "error";

export function DesktopConnectionPanel() {
  const isDesktopEnv = isDesktop();
  const [activeUrl, setActiveUrl] = useState(() => getBackendUrlSync() || "");
  const [url, setUrl] = useState(activeUrl || "http://localhost:5000");
  const [status, setStatus] = useState<TestStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [validationError, setValidationError] = useState("");
  const [saved, setSaved] = useState(false);
  const [lastTestedUrl, setLastTestedUrl] = useState("");
  const [isInsecure, setIsInsecure] = useState(false);

  if (!isDesktopEnv) {
    return null;
  }

  async function handleTest() {
    const check = validateBackendUrl(url);
    if (!check.valid) {
      setValidationError(check.error || "Invalid URL");
      setStatus("error");
      setStatusMessage(check.error || "Invalid URL");
      setIsInsecure(false);
      return;
    }
    setValidationError("");
    setIsInsecure(!!check.isInsecure);
    setStatus("testing");
    setSaved(false);
    const result = await testBackendConnection(check.normalized);
    setStatus(result.ok ? "success" : "error");
    setStatusMessage(result.message);
    if (result.ok) {
      setLastTestedUrl(check.normalized);
      setUrl(check.normalized);
    }
  }

  function handleSave() {
    if (!lastTestedUrl) {
      return;
    }
    setBackendUrl(lastTestedUrl);
    setActiveUrl(lastTestedUrl);
    setSaved(true);
    queryClient.clear();
  }

  return (
    <Card data-testid="panel-desktop-connection">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <CardTitle>Backend Connection</CardTitle>
          </div>
          {activeUrl && (
            <Badge variant="outline" data-testid="badge-backend-url">
              {activeUrl}
            </Badge>
          )}
        </div>
        <CardDescription>
          Configure which ARUS backend server this desktop app connects to
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="admin-backend-url">Server URL</Label>
          <div className="flex gap-2">
            <Input
              id="admin-backend-url"
              data-testid="input-admin-backend-url"
              placeholder="http://localhost:5000"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (status !== "idle") {
                  setStatus("idle");
                }
                setValidationError("");
                setSaved(false);
                setLastTestedUrl("");
                setIsInsecure(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleTest()}
            />
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={status === "testing" || !url.trim()}
              data-testid="button-test-admin-connection"
            >
              {status === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
            </Button>
          </div>
          {validationError && status !== "testing" && (
            <p className="text-xs text-destructive">{validationError}</p>
          )}
        </div>

        {status === "success" && (
          <div className="flex items-center gap-2 text-sm p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            {statusMessage}
          </div>
        )}

        {status === "error" && !validationError && (
          <div className="flex items-center gap-2 text-sm p-3 rounded-md bg-destructive/10 text-destructive">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            {statusMessage}
          </div>
        )}

        {isInsecure && status === "success" && (
          <div className="flex items-center gap-2 text-sm p-3 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            This connection uses HTTP. Passwords will be sent in plaintext over the network. Use
            HTTPS for non-localhost connections.
          </div>
        )}

        {status === "success" && !saved && lastTestedUrl !== activeUrl && (
          <Button onClick={handleSave} data-testid="button-save-backend-url">
            Save & Apply
          </Button>
        )}

        {saved && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Connection Updated</AlertTitle>
            <AlertDescription>
              Backend URL updated. Data has been refreshed from the new server.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
