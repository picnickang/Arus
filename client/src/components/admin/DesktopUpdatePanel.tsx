import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  RefreshCw,
  Download,
  CheckCircle,
  AlertCircle,
  Info,
  Loader2,
  ArrowUpCircle,
  Cloud,
} from "lucide-react";
import {
  isDesktop,
  getDesktopAPI,
  type UpdateInfo,
} from "@/lib/desktop";
import { ReleaseNotesMarkdown } from "@/components/ui/safe-markdown";

type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  releaseNotes?: string;
  error?: string;
}

export function DesktopUpdatePanel() {
  const [state, setState] = useState<UpdateState>({
    status: "idle",
    currentVersion: "unknown",
  });

  const [isDesktopEnv, setIsDesktopEnv] = useState(false);

  useEffect(() => {
    const desktopDetected = isDesktop();
    setIsDesktopEnv(desktopDetected);

    if (desktopDetected) {
      const api = getDesktopAPI();
      if (api) {
        api.getAppVersion().then((version) => {
          setState((prev) => ({ ...prev, currentVersion: version }));
        });
      }
    }
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    const api = getDesktopAPI();
    if (!api) return;

    setState((prev) => ({ ...prev, status: "checking", error: undefined }));

    try {
      const updateInfo: UpdateInfo | null = await api.checkForUpdates();
      if (updateInfo) {
        setState((prev) => ({
          ...prev,
          status: "available",
          availableVersion: updateInfo.version,
          releaseNotes: updateInfo.body,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: "not-available",
        }));
      }
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err?.message || "Failed to check for updates",
      }));
    }
  }, []);

  const handleInstall = useCallback(async () => {
    const api = getDesktopAPI();
    if (!api) return;

    setState((prev) => ({ ...prev, status: "downloading" }));

    try {
      await api.installUpdate();
      setState((prev) => ({ ...prev, status: "downloaded" }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err?.message || "Failed to install update",
      }));
    }
  }, []);

  if (!isDesktopEnv) {
    return (
      <Card data-testid="panel-web-update-info">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Software Updates</CardTitle>
          </div>
          <CardDescription>Web deployment update management</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Web Deployment</AlertTitle>
            <AlertDescription>
              You are running ARUS in a browser or server deployment. Software updates are
              automatically managed by the server infrastructure and deployment pipeline. No manual
              update action is required in this environment.
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-sm text-muted-foreground">
            <p>
              For vessel/desktop deployments, use the ARUS Desktop Application which supports
              automatic updates via Tauri's built-in updater.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="panel-desktop-updates">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-primary" />
            <CardTitle>Desktop App Updates</CardTitle>
          </div>
          <Badge variant="outline" data-testid="badge-current-version">
            v{state.currentVersion}
          </Badge>
        </div>
        <CardDescription>
          Check for and install updates for the ARUS Desktop Application
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.status === "idle" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-muted-foreground">Click to check for available updates</p>
            <Button onClick={handleCheckForUpdates} data-testid="button-check-updates">
              <RefreshCw className="mr-2 h-4 w-4" />
              Check for Updates
            </Button>
          </div>
        )}

        {state.status === "checking" && (
          <div className="flex items-center gap-3 py-4" data-testid="status-checking">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Checking for updates...</span>
          </div>
        )}

        {state.status === "not-available" && (
          <Alert data-testid="status-up-to-date">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle>Up to Date</AlertTitle>
            <AlertDescription>
              You are running the latest version of ARUS (v{state.currentVersion}).
            </AlertDescription>
          </Alert>
        )}

        {state.status === "available" && (
          <div className="space-y-4" data-testid="status-available">
            <Alert>
              <ArrowUpCircle className="h-4 w-4 text-blue-500" />
              <AlertTitle>Update Available</AlertTitle>
              <AlertDescription>
                Version {state.availableVersion} is available. You are currently running v
                {state.currentVersion}.
              </AlertDescription>
            </Alert>
            {state.releaseNotes && (
              <ReleaseNotesMarkdown
                content={state.releaseNotes}
                data-testid="release-notes-markdown"
              />
            )}
            <Button onClick={handleInstall} className="w-full" data-testid="button-download">
              <Download className="mr-2 h-4 w-4" />
              Download & Install Update
            </Button>
          </div>
        )}

        {state.status === "downloading" && (
          <div className="flex items-center gap-3 py-4" data-testid="status-downloading">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Downloading and installing update...</span>
          </div>
        )}

        {state.status === "downloaded" && (
          <div className="space-y-4" data-testid="status-downloaded">
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle>Update Installed</AlertTitle>
              <AlertDescription>
                Update v{state.availableVersion} has been installed. The application will restart
                to apply changes.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {state.status === "error" && (
          <div className="space-y-4" data-testid="status-error">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Update Error</AlertTitle>
              <AlertDescription>{state.error || "An unknown error occurred"}</AlertDescription>
            </Alert>
            <Button
              onClick={handleCheckForUpdates}
              variant="outline"
              data-testid="button-retry"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        )}

        {(state.status === "not-available" ||
          state.status === "error" ||
          state.status === "downloaded") && (
          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCheckForUpdates}
              data-testid="button-check-again"
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Check Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
