import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Anchor,
  Server,
  ArrowRight,
  ArrowLeft,
  Ship,
  LogIn,
  AlertTriangle,
} from "lucide-react";
import {
  testBackendConnection,
  setBackendUrl,
  getBackendUrlSync,
  setVesselId,
  setVesselName,
} from "@/lib/desktopFetch";
import { validateBackendUrl } from "@/lib/urlValidation";
import { apiRequest } from "@/lib/queryClient";
import { setApiSessionToken } from "@/lib/sessionToken";
import { ROLE_STORAGE_KEY, BOTTOM_NAV_OVERRIDE_STORAGE_KEY } from "@/config/roles";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

interface DesktopSetupProps {
  onComplete: () => void;
}

type ConnectionStatus = "idle" | "testing" | "success" | "error";
type SetupStep = "backend" | "vessel" | "signin";

interface Vessel {
  id: string;
  name: string;
  imo?: string;
  vesselType?: string;
  active?: boolean;
}

interface LoginResponse {
  sessionToken: string;
  expiresIn: number;
  mustChangePassword: boolean;
  user: { id: string; name: string | null; role: string };
}

// Persist the DB-assigned role so the app renders the right landing experience
// after setup completes. Mirrors the helper in the portal-login screen.
function rememberRoleHint(role: string) {
  try {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
    localStorage.removeItem(BOTTOM_NAV_OVERRIDE_STORAGE_KEY);
  } catch {
    // localStorage may be unavailable (private mode); the role policy falls
    // back to its default branch.
  }
}

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
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

function BackendStep({ onNext }: { onNext: (url: string) => void }) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Backend Server
        </CardTitle>
        <CardDescription>
          Enter the URL of your ARUS backend server. For vessel deployments, this is typically the
          local server address.
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

function VesselStep({
  backendUrl,
  onNext,
  onBack,
}: {
  backendUrl: string;
  onNext: (vesselId: string, vesselName: string) => void;
  onBack: () => void;
}) {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedName, setSelectedName] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function fetchVessels() {
      try {
        const res = await fetch(`${backendUrl}/api/vessels`, {
          headers: { "x-org-id": "default-org-id" },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Status ${res.status}`);
        }
        const data = await res.json();
        // Setup probes a candidate backend URL directly (no app plumbing
        // yet), so tolerate both legacy bodies and the {success, data}
        // envelope.
        const body =
          data && typeof data === "object" && "success" in data && "data" in data
            ? data.data
            : data;
        const vesselList = Array.isArray(body) ? body : body?.vessels || [];
        if (!controller.signal.aborted) {
          setVessels(vesselList.filter((v: Vessel) => v.active !== false));
        }
      } catch (e: unknown) {
        if (controller.signal.aborted) {
          return;
        }
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(`Could not load vessels: ${msg}`);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    fetchVessels();
    return () => controller.abort();
  }, [backendUrl]);

  function handleSelect(v: Vessel) {
    setSelectedId(v.id);
    setSelectedName(v.name);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ship className="h-5 w-5" />
          Select Vessel
        </CardTitle>
        <CardDescription>
          Choose which vessel this desktop installation is associated with. This determines which
          equipment and telemetry data you see.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div
            className="flex items-center justify-center py-8 text-muted-foreground"
            data-testid="loading-vessels"
          >
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading vessels...
          </div>
        )}

        {error && (
          <div
            className="flex items-center gap-2 text-sm p-3 rounded-md bg-destructive/10 text-destructive"
            data-testid="text-vessel-error"
          >
            <XCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && vessels.length === 0 && (
          <div className="text-center py-6 text-muted-foreground" data-testid="text-no-vessels">
            <Ship className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              No vessels found. You can add vessels after setup from the Fleet management page.
            </p>
          </div>
        )}

        {!loading && vessels.length > 0 && (
          <div
            className="grid gap-2 max-h-60 overflow-y-auto"
            data-testid="vessel-list"
            role="listbox"
            aria-label="Available vessels"
          >
            {vessels.map((v) => (
              <button
                key={v.id}
                onClick={() => handleSelect(v)}
                role="option"
                aria-selected={selectedId === v.id}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                  selectedId === v.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted/50"
                }`}
                data-testid={`button-vessel-${v.id}`}
              >
                <Ship
                  className={`h-5 w-5 flex-shrink-0 ${selectedId === v.id ? "text-primary" : "text-muted-foreground"}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{v.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {v.imo && <span>IMO: {v.imo}</span>}
                    {v.imo && v.vesselType && <span> · </span>}
                    {v.vesselType && <span>{v.vesselType}</span>}
                  </div>
                </div>
                {selectedId === v.id && (
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} data-testid="button-back-vessel">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={() => onNext(selectedId, selectedName)}
            disabled={!selectedId && vessels.length > 0}
            data-testid="button-next-vessel"
          >
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SignInStep({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = useMutation<LoginResponse>({
    mutationFn: () =>
      apiRequest("POST", "/api/portal/login", {
        username: username.trim(),
        password,
        orgId: DEFAULT_ORG_ID,
      }),
    onSuccess: (data) => {
      rememberRoleHint(data.user.role);
      if (data.mustChangePassword) {
        // Do NOT adopt the session: the account must set a new password first.
        // Completing setup without a token routes the app to the full
        // `/portal-login` screen, which implements the change-password flow.
        onComplete();
        return;
      }
      // Adopt the real account session. The remounted app tree (and its
      // AdminAccessProvider) picks this in-memory token up to keep the user
      // signed in — admins are unlocked there via the stored role hint.
      setApiSessionToken(data.sessionToken);
      onComplete();
    },
    onError: () =>
      setError(
        "Sign-in failed. Check your username and password, or your account may be disabled."
      ),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    login.mutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="h-5 w-5" />
          Sign In
        </CardTitle>
        <CardDescription>
          Sign in with your ARUS account to finish setup. Admin access requires an admin account —
          there is no shared admin password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="signin-username">Username</Label>
            <Input
              id="signin-username"
              data-testid="input-signin-username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) {
                  setError(null);
                }
              }}
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signin-password">Password</Label>
            <Input
              id="signin-password"
              data-testid="input-signin-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) {
                  setError(null);
                }
              }}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div
              className="flex items-center gap-2 text-sm p-3 rounded-md bg-destructive/10 text-destructive"
              data-testid="text-signin-error"
              role="alert"
              aria-live="polite"
            >
              <XCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              data-testid="button-back-signin"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={login.isPending || !username.trim() || !password}
              data-testid="button-signin"
            >
              {login.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <LogIn className="h-4 w-4 mr-2" />
              )}
              {login.isPending ? "Signing in..." : "Sign In & Finish"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function DesktopSetup({ onComplete }: DesktopSetupProps) {
  const [step, setStep] = useState<SetupStep>("backend");
  const [backendUrl, setConnectedUrl] = useState("");

  const stepIndex = step === "backend" ? 0 : step === "vessel" ? 1 : 2;
  const stepLabels = ["Connection", "Vessel", "Sign In"];

  function handleBackendNext(url: string) {
    setConnectedUrl(url);
    setStep("vessel");
  }

  function handleVesselNext(vesselIdVal: string, vesselNameVal: string) {
    if (vesselIdVal) {
      setVesselId(vesselIdVal);
      setVesselName(vesselNameVal);
    } else {
      localStorage.removeItem("arus-vessel-id");
      localStorage.removeItem("arus-vessel-name");
    }
    // Persist the backend URL now so the sign-in step's API request resolves
    // against the configured backend.
    setBackendUrl(backendUrl);
    setStep("signin");
  }

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center p-4"
      data-testid="desktop-setup-page"
    >
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
            <Anchor className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-setup-title">
            ARUS Setup
          </h1>
          <p className="text-muted-foreground text-sm">Configure your desktop application</p>
        </div>

        <StepIndicator current={stepIndex} steps={stepLabels} />

        {step === "backend" && <BackendStep onNext={handleBackendNext} />}
        {step === "vessel" && (
          <VesselStep
            backendUrl={backendUrl}
            onNext={handleVesselNext}
            onBack={() => setStep("backend")}
          />
        )}
        {step === "signin" && (
          <SignInStep onBack={() => setStep("vessel")} onComplete={onComplete} />
        )}
      </div>
    </div>
  );
}
