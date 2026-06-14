import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Key, Loader2, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function OpenAIKeyCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");

  // The API never returns key material (0043) — only hasOpenaiKey.
  const settingsQuery = useQuery<{ hasOpenaiKey?: boolean; llmModel?: string | null }>({
    queryKey: ["/api/settings"],
  });

  const validateQuery = useQuery<{
    valid: boolean;
    status: string;
    message: string;
    source: string | null;
    hasDbKey: boolean;
    hasEnvKey: boolean;
  }>({
    queryKey: ["/api/settings", "validate-openai-key"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/settings/validate-openai-key");
      return res as {
        valid: boolean;
        status: string;
        message: string;
        source: string | null;
        hasDbKey: boolean;
        hasEnvKey: boolean;
      };
    },
    refetchOnWindowFocus: false,
    staleTime: 60000,
    enabled: !!settingsQuery.data,
  });

  const saveMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("PUT", "/api/settings", { openaiApiKey: key });
      return res as { hasOpenaiKey?: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "API key saved",
        description: "Your OpenAI API key has been saved. Validating with OpenAI...",
      });
      setApiKey("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save",
        description: error.message || "Could not save API key. Please try again.",
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PUT", "/api/settings", { openaiApiKey: "" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "API key removed", description: "Your OpenAI API key has been cleared." });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove",
        description: error.message || "Could not remove API key. Please try again.",
        variant: "destructive",
      });
    },
  });

  const hasKey = !!settingsQuery.data?.hasOpenaiKey;

  const statusBadge = () => {
    if (saveMutation.isPending || removeMutation.isPending) {
      return (
        <Badge variant="outline">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Saving
        </Badge>
      );
    }
    if (validateQuery.isLoading || validateQuery.isFetching) {
      return (
        <Badge variant="outline">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Validating
        </Badge>
      );
    }
    if (!hasKey && !validateQuery.data?.valid) {
      return (
        <Badge variant="secondary" data-testid="badge-openai-status">
          Not Set
        </Badge>
      );
    }
    if (validateQuery.data?.valid) {
      return (
        <Badge variant="default" className="bg-green-600" data-testid="badge-openai-status">
          <CheckCircle className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }
    if (hasKey && validateQuery.data && !validateQuery.data.valid) {
      return (
        <Badge variant="destructive" data-testid="badge-openai-status">
          <XCircle className="h-3 w-3 mr-1" />
          Invalid Key
        </Badge>
      );
    }
    return null;
  };

  return (
    <Card data-testid="card-openai-settings">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">OpenAI API Key</CardTitle>
            <CardDescription className="text-sm">
              Configure your OpenAI API key for AI Copilot, reports, and predictive analytics
            </CardDescription>
          </div>
          {statusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasKey && (
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <span className="text-sm font-mono flex-1" data-testid="text-current-key">
              sk-••••••••••••
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
              data-testid="button-remove-key"
            >
              {removeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Remove
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input
            type="password"
            placeholder={
              hasKey ? "Enter new API key to replace..." : "Enter your OpenAI API key (sk-...)"
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            data-testid="input-openai-key"
          />
          <Button
            onClick={() => saveMutation.mutate(apiKey)}
            disabled={!apiKey.trim() || saveMutation.isPending}
            data-testid="button-save-key"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
        {hasKey &&
          validateQuery.data &&
          !validateQuery.data.valid &&
          validateQuery.data.status !== "not_configured" && (
            <p className="text-xs text-destructive" data-testid="text-validation-error">
              Key saved but validation failed: {validateQuery.data.message}. Please check your key
              is correct.
            </p>
          )}
        {validateQuery.data?.valid && (
          <p className="text-xs text-muted-foreground" data-testid="text-validation-source">
            {validateQuery.data.source === "user_configured"
              ? "Using your configured key"
              : validateQuery.data.source === "environment"
                ? "Using environment variable key"
                : `Source: ${validateQuery.data.source || "auto-detected"}`}
          </p>
        )}
        {!hasKey && validateQuery.data?.hasEnvKey && validateQuery.data?.valid && (
          <p className="text-xs text-muted-foreground">
            An environment key is active. You can optionally set a custom key above to override it.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
