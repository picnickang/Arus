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
  ArrowRight,
  ArrowLeft,
  Ship,
  LogIn,
} from "lucide-react";
import {
  markCloudLinkPending,
  setBackendUrl,
  setVesselId,
  setVesselName,
} from "@/lib/desktopFetch";
import { apiRequest } from "@/lib/queryClient";
import { setApiSessionToken } from "@/lib/sessionToken";
import { ROLE_STORAGE_KEY, BOTTOM_NAV_OVERRIDE_STORAGE_KEY } from "@/config/roles";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { BackendStep, StepIndicator, type BackendStepOptions } from "./desktop-setup-steps";

interface DesktopSetupProps {
  onComplete: () => void;
}

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

function SignInStep({
  cloudLinkPending,
  onBack,
  onComplete,
}: {
  cloudLinkPending: boolean;
  onBack: () => void;
  onComplete: () => void;
}) {
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
      markCloudLinkPending(false);
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

  function finishOffline() {
    markCloudLinkPending(true);
    onComplete();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="h-5 w-5" />
          Sign In
        </CardTitle>
        <CardDescription>
          Cloud link optional. Sign in now when connected, or finish offline and let ARUS sync
          queued changes after the cloud link is available.
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

          {cloudLinkPending && (
            <div
              className="flex items-center gap-2 text-sm p-3 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300"
              data-testid="text-cloud-link-pending"
              aria-live="polite"
            >
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Local database ready. Cloud sync will remain pending until this desktop is linked.
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="sm:w-auto"
              data-testid="button-back-signin"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={finishOffline}
              className="sm:w-auto"
              data-testid="button-finish-offline"
            >
              Finish Offline
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
  const [cloudLinkPending, setCloudLinkPending] = useState(true);

  const stepIndex = step === "backend" ? 0 : step === "vessel" ? 1 : 2;
  const stepLabels = ["Local Database", "Cloud Link", "Sync"];

  function handleBackendNext(url: string, options: BackendStepOptions = {}) {
    setConnectedUrl(url);
    setCloudLinkPending(options.cloudLinkPending ?? !url.startsWith("https://"));
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
          <p className="text-muted-foreground text-sm">
            Local Database first. Cloud Link optional. Sync resumes when connected.
          </p>
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
          <SignInStep
            cloudLinkPending={cloudLinkPending}
            onBack={() => setStep("vessel")}
            onComplete={onComplete}
          />
        )}
      </div>
    </div>
  );
}
