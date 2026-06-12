import { useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Server, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBackendUrlSync, testBackendConnection } from "@/lib/desktopFetch";
import { validateBackendUrl } from "@/lib/urlValidation";

type ConnectionStatus = "idle" | "testing" | "success" | "error";
export interface BackendStepOptions {
  cloudLinkPending?: boolean;
}

export function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div
      className="flex items-center justify-center gap-2 mb-6"
      data-testid="step-indicator"
      aria-label="Setup progress"
    >
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i < current
                  ? "bg-primary text-primary-foreground"
                  : i === current
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                    : "bg-muted text-muted-foreground"
              }`}
              data-testid={`step-dot-${i}`}
              aria-label={`Step ${i + 1}: ${label}${i < current ? " (completed)" : i === current ? " (current)" : ""}`}
            >
              {i < current ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-xs hidden sm:inline ${i === current ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${i < current ? "bg-primary" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export function BackendStep({
  onNext,
}: {
  onNext: (url: string, options?: BackendStepOptions) => void;
}) {
  const existing = getBackendUrlSync();
  const [url, setUrl] = useState(existing || "http://localhost:5000");
  const [status, setStatus] = useState<ConnectionStatus>(existing ? "success" : "idle");
  const [statusMessage, setStatusMessage] = useState(existing ? "Using saved connection" : "");
  const [testedUrl, setTestedUrl] = useState(existing || "");
  const [isInsecure, setIsInsecure] = useState(false);

  async function handleTest() {
    if (!url.trim()) {
      return;
    }

    const validation = validateBackendUrl(url.trim());
    if (!validation.valid) {
      setStatus("error");
      setStatusMessage(validation.error || "Invalid URL");
      setTestedUrl("");
      setIsInsecure(false);
      return;
    }

    setIsInsecure(!!validation.isInsecure);
    setStatus("testing");
    setStatusMessage("Testing connection...");
    const result = await testBackendConnection(validation.normalized);
    if (result.ok) {
      setStatus("success");
      setStatusMessage(result.message);
      setTestedUrl(validation.normalized);
    } else {
      setStatus("error");
      setStatusMessage(result.message);
      setTestedUrl("");
    }
  }

  async function handleUseLocalOfflineMode() {
    const localUrl = "http://localhost:5000";
    setUrl(localUrl);
    setIsInsecure(false);
    setStatus("testing");
    setStatusMessage("Checking local database...");
    const result = await testBackendConnection(localUrl);
    if (!result.ok) {
      setStatus("error");
      setStatusMessage(`Local backend is not ready: ${result.message}`);
      setTestedUrl("");
      return;
    }
    setStatus("success");
    setStatusMessage("Local database ready. Cloud link pending; changes stay queued offline.");
    setTestedUrl(localUrl);
    onNext(localUrl, { cloudLinkPending: true });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Local Database
        </CardTitle>
        <CardDescription>
          ARUS starts with the local database and backend sidecar. Cloud linking can happen later;
          user changes and telemetry remain queued while offline.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="backend-url">Server URL</Label>
          <div className="flex gap-2">
            <Input
              id="backend-url"
              data-testid="input-backend-url"
              placeholder="http://localhost:5000"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (status !== "idle") {
                  setStatus("idle");
                  setTestedUrl("");
                  setIsInsecure(false);
                }
              }}
              onKeyDown={(e) => e.key === "Enter" && handleTest()}
            />
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={status === "testing" || !url.trim()}
              data-testid="button-test-connection"
            >
              {status === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
            </Button>
          </div>
        </div>

        {status !== "idle" && status !== "testing" && (
          <div
            className={`flex items-center gap-2 text-sm p-3 rounded-md ${
              status === "success"
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-destructive/10 text-destructive"
            }`}
            data-testid="text-connection-status"
            aria-live="polite"
          >
            {status === "success" ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 flex-shrink-0" />
            )}
            {statusMessage}
          </div>
        )}

        {isInsecure && status === "success" && (
          <div
            className="flex items-center gap-2 text-sm p-3 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400"
            aria-live="polite"
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            This connection uses HTTP. Passwords will be sent in plaintext over the network. Use
            HTTPS for non-localhost connections.
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Common configurations:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>
              Local vessel server: <code className="text-foreground/80">http://localhost:5000</code>
            </li>
            <li>
              Network vessel server:{" "}
              <code className="text-foreground/80">http://192.168.x.x:5000</code>
            </li>
            <li>
              Cloud server: <code className="text-foreground/80">https://your-org.arus.io</code>
            </li>
          </ul>
        </div>

        <Button
          className="w-full"
          onClick={handleUseLocalOfflineMode}
          disabled={status === "testing"}
          data-testid="button-use-local-offline-mode"
        >
          {status === "testing" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Use Local Offline Mode
        </Button>

        <Button
          className="w-full"
          variant="outline"
          onClick={() => onNext(testedUrl)}
          disabled={status !== "success" || !testedUrl}
          data-testid="button-next-backend"
        >
          Next
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
