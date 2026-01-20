/**
 * Electron Auto-Update Panel
 * 
 * This component provides a user interface for managing software updates
 * when running in the Electron desktop app. For web deployments, it shows
 * a fallback message explaining that updates are server-managed.
 * 
 * ## Features
 * 
 * - Check for updates manually
 * - Download available updates
 * - Install and restart to apply updates
 * - Progress tracking during download
 * - Error handling and retry
 * 
 * ## State Machine
 * 
 * idle → checking → available → downloading → downloaded → (restart)
 *                 ↘ not-available
 *                 ↘ error
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  isElectron,
  getElectronAPI,
  type UpdateAvailableData,
  type UpdateProgressData,
  type UpdateDownloadedData,
  type UpdateErrorData,
} from "@/lib/electron";
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
  progress?: number;
  bytesPerSecond?: number;
  error?: string;
}

export function ElectronUpdatePanel() {
  const [state, setState] = useState<UpdateState>({
    status: "idle",
    currentVersion: "unknown",
  });

  const [isElectronEnv, setIsElectronEnv] = useState(false);

  useEffect(() => {
    const electronDetected = isElectron();
    setIsElectronEnv(electronDetected);

    if (electronDetected) {
      const api = getElectronAPI();
      if (api) {
        api.update.getVersion().then((version) => {
          setState((prev) => ({ ...prev, currentVersion: version }));
        });

        const cleanupAvailable = api.update.onAvailable((data: UpdateAvailableData) => {
          setState((prev) => ({
            ...prev,
            status: "available",
            availableVersion: data.version,
            releaseNotes: data.releaseNotes,
          }));
        });

        const cleanupNotAvailable = api.update.onNotAvailable(() => {
          setState((prev) => ({
            ...prev,
            status: "not-available",
          }));
        });

        const cleanupProgress = api.update.onDownloadProgress((data: UpdateProgressData) => {
          setState((prev) => ({
            ...prev,
            status: "downloading",
            progress: data.percent,
            bytesPerSecond: data.bytesPerSecond,
          }));
        });

        const cleanupDownloaded = api.update.onDownloaded((data: UpdateDownloadedData) => {
          setState((prev) => ({
            ...prev,
            status: "downloaded",
            availableVersion: data.version,
            releaseNotes: data.releaseNotes,
          }));
        });

        const cleanupError = api.update.onError((data: UpdateErrorData) => {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: data.message,
          }));
        });

        return () => {
          cleanupAvailable();
          cleanupNotAvailable();
          cleanupProgress();
          cleanupDownloaded();
          cleanupError();
        };
      }
    }
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    const api = getElectronAPI();
    if (!api) {return;}

    setState((prev) => ({ ...prev, status: "checking", error: undefined }));

    const result = await api.update.check();
    if (!result.success && result.error) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: result.error,
      }));
    }
  }, []);

  const handleDownload = useCallback(async () => {
    const api = getElectronAPI();
    if (!api) {return;}

    setState((prev) => ({ ...prev, status: "downloading", progress: 0 }));

    const result = await api.update.download();
    if (!result.success && result.error) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: result.error,
      }));
    }
  }, []);

  const handleInstall = useCallback(() => {
    const api = getElectronAPI();
    if (!api) {return;}

    api.update.install();
  }, []);

  if (!isElectronEnv) {
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
              automatic updates via GitHub Releases.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="panel-electron-updates">
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
            <Button onClick={handleDownload} className="w-full" data-testid="button-download">
              <Download className="mr-2 h-4 w-4" />
              Download Update
            </Button>
          </div>
        )}

        {state.status === "downloading" && (
          <div className="space-y-4" data-testid="status-downloading">
            <div className="flex items-center justify-between">
              <span>Downloading update...</span>
              <span className="text-sm text-muted-foreground">
                {Math.round(state.progress || 0)}%
              </span>
            </div>
            <Progress value={state.progress || 0} className="h-2" />
            {state.bytesPerSecond && (
              <p className="text-sm text-muted-foreground">
                {Math.round(state.bytesPerSecond / 1024)} KB/s
              </p>
            )}
          </div>
        )}

        {state.status === "downloaded" && (
          <div className="space-y-4" data-testid="status-downloaded">
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle>Ready to Install</AlertTitle>
              <AlertDescription>
                Update v{state.availableVersion} has been downloaded and is ready to install. The
                application will restart to apply the update.
              </AlertDescription>
            </Alert>
            <Button
              onClick={handleInstall}
              className="w-full"
              variant="default"
              data-testid="button-install"
            >
              <ArrowUpCircle className="mr-2 h-4 w-4" />
              Install and Restart
            </Button>
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
