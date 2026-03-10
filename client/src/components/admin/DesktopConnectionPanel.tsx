import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Server, CheckCircle2, XCircle, Loader2, Info } from "lucide-react";
import { isDesktop } from "@/lib/desktop";
import { getBackendUrlSync, setBackendUrl, testBackendConnection } from "@/lib/desktopFetch";

type TestStatus = "idle" | "testing" | "success" | "error";

function isValidBackendUrl(raw: string): { valid: boolean; normalized: string; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: false, normalized: "", error: "URL is required" };

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, normalized: trimmed, error: "Only http:// and https:// URLs are supported" };
    }
    if (!parsed.hostname) {
      return { valid: false, normalized: trimmed, error: "Invalid hostname" };
    }
    const normalized = parsed.origin;
    return { valid: true, normalized };
  } catch {
    return { valid: false, normalized: trimmed, error: "Invalid URL format. Example: http://localhost:5000" };
  }
}

export function DesktopConnectionPanel() {
  const isDesktopEnv = isDesktop();
  const [activeUrl, setActiveUrl] = useState(() => getBackendUrlSync() || "");
  const [url, setUrl] = useState(activeUrl || "http://localhost:5000");
  const [status, setStatus] = useState<TestStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [validationError, setValidationError] = useState("");
  const [saved, setSaved] = useState(false);
  const [lastTestedUrl, setLastTestedUrl] = useState("");

  if (!isDesktopEnv) {
    return null;
  }

  async function handleTest() {
    const check = isValidBackendUrl(url);
    if (!check.valid) {
      setValidationError(check.error || "Invalid URL");
      setStatus("error");
      setStatusMessage(check.error || "Invalid URL");
      return;
    }
    setValidationError("");
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
    if (!lastTestedUrl) return;
    setBackendUrl(lastTestedUrl);
    setActiveUrl(lastTestedUrl);
    setSaved(true);
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
                if (status !== "idle") setStatus("idle");
                setValidationError("");
                setSaved(false);
                setLastTestedUrl("");
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
              Backend URL updated. Reload the application for changes to take full effect.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
