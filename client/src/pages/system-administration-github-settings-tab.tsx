import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useGitHubSettingsData } from "@/features/settings";
import { AlertTriangle, CheckCircle, Github, Settings } from "lucide-react";

export function GitHubSettingsTab() {
  const g = useGitHubSettingsData();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            GitHub Connection
          </CardTitle>
          <CardDescription>
            GitHub is connected via Replit integration for accessing releases
          </CardDescription>
        </CardHeader>
        <CardContent>
          {g.githubLoading ? (
            <div className="flex items-center gap-4 p-4 border rounded-lg animate-pulse">
              <div className="h-10 w-10 bg-muted rounded-full" />
              <div className="space-y-2">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-3 w-48 bg-muted rounded" />
              </div>
            </div>
          ) : g.githubStatus?.connected ? (
            <div className="flex items-center gap-4 p-4 border border-green-500/50 bg-green-500/10 rounded-lg">
              {g.githubStatus.user?.avatar_url && (
                <img
                  src={g.githubStatus.user.avatar_url}
                  alt={g.githubStatus.user.login}
                  loading="lazy"
                  className="h-10 w-10 rounded-full"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-green-700 dark:text-green-400">Connected</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Signed in as <strong>{g.githubStatus.user?.login}</strong>
                  {g.githubStatus.user?.name && ` (${g.githubStatus.user.name})`}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 border border-amber-500/50 bg-amber-500/10 rounded-lg">
                <AlertTriangle className="h-10 w-10 text-amber-600" />
                <div className="flex-1">
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    GitHub Connection Required
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Connect your GitHub account to enable automatic software updates for vessel
                    deployments.
                  </p>
                </div>
              </div>
              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium mb-3">How to Connect GitHub:</h4>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
                  <li>
                    Look for the <strong>"Tools"</strong> panel on the left sidebar in Replit
                  </li>
                  <li>
                    Find and click <strong>"GitHub"</strong> in the integrations list
                  </li>
                  <li>
                    Click <strong>"Connect"</strong> and authorize access to your repositories
                  </li>
                  <li>Return here - the connection will be detected automatically</li>
                </ol>
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-sm">
                  <strong className="text-blue-700 dark:text-blue-400">
                    Why use Replit's GitHub integration?
                  </strong>
                  <p className="text-muted-foreground mt-1">
                    Replit securely manages your GitHub OAuth tokens with automatic refresh - no API
                    keys to store or rotate manually.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {g.githubStatus?.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Release Repository
            </CardTitle>
            <CardDescription>
              Select which GitHub repository to monitor for Tauri desktop app updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {g.settings?.githubOwner && g.settings?.githubRepo && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  Currently monitoring:{" "}
                  <strong>
                    {g.settings.githubOwner}/{g.settings.githubRepo}
                  </strong>
                </span>
              </div>
            )}
            {g.reposLoading ? (
              <div className="text-sm text-muted-foreground">Loading repositories...</div>
            ) : g.reposData?.repos?.length ? (
              <div className="space-y-2">
                <Label>Select a repository:</Label>
                <div className="grid gap-2 max-h-60 overflow-y-auto">
                  {g.reposData.repos.map((repo) => (
                    <Button
                      key={repo.id}
                      variant={
                        g.settings?.githubRepo === repo.name &&
                        g.settings?.githubOwner === repo.owner
                          ? "default"
                          : "outline"
                      }
                      className="justify-start h-auto py-3"
                      onClick={() =>
                        g.selectRepoMutation.mutate({ owner: repo.owner, repo: repo.name })
                      }
                      disabled={g.selectRepoMutation.isPending}
                      data-testid={`button-select-repo-${repo.name}`}
                    >
                      <Github className="mr-2 h-4 w-4" />
                      <div className="text-left">
                        <div className="font-medium">{repo.full_name}</div>
                        <div className="text-xs text-muted-foreground">{repo.html_url}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No repositories found. Make sure your GitHub account has accessible repositories.
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How GitHub Releases Work</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
            <li>GitHub is connected via Replit integration (automatic token management)</li>
            <li>Select which repository to monitor for releases above</li>
            <li>Build your Tauri desktop app with tauri:build</li>
            <li>Publish releases to GitHub - desktop apps will automatically update</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
