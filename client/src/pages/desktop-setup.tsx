import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle, Anchor, Server, ArrowRight } from 'lucide-react';
import { testBackendConnection, setBackendUrl } from '@/lib/desktopFetch';

interface DesktopSetupProps {
  onComplete: () => void;
}

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

export default function DesktopSetup({ onComplete }: DesktopSetupProps) {
  const [backendUrl, setUrl] = useState('http://localhost:5000');
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  async function handleTest() {
    if (!backendUrl.trim()) return;
    setStatus('testing');
    setStatusMessage('Testing connection...');

    const result = await testBackendConnection(backendUrl.trim());
    if (result.ok) {
      setStatus('success');
      setStatusMessage(result.message);
    } else {
      setStatus('error');
      setStatusMessage(result.message);
    }
  }

  function handleContinue() {
    setBackendUrl(backendUrl.trim());
    onComplete();
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="desktop-setup-page">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Anchor className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-setup-title">ARUS Setup</h1>
          <p className="text-muted-foreground">Configure your desktop application to connect to the ARUS backend server.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Backend Server
            </CardTitle>
            <CardDescription>
              Enter the URL of your ARUS backend server. For vessel deployments, this is typically the local server address. For cloud deployments, use your organization's server URL.
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
                  value={backendUrl}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (status !== 'idle') setStatus('idle');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleTest()}
                />
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={status === 'testing' || !backendUrl.trim()}
                  data-testid="button-test-connection"
                >
                  {status === 'testing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Test'
                  )}
                </Button>
              </div>
            </div>

            {status !== 'idle' && status !== 'testing' && (
              <div
                className={`flex items-center gap-2 text-sm p-3 rounded-md ${
                  status === 'success'
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-destructive/10 text-destructive'
                }`}
                data-testid="text-connection-status"
              >
                {status === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                )}
                {statusMessage}
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p>Common configurations:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Local vessel server: <code className="text-foreground/80">http://localhost:5000</code></li>
                <li>Network vessel server: <code className="text-foreground/80">http://192.168.x.x:5000</code></li>
                <li>Cloud server: <code className="text-foreground/80">https://your-org.arus.io</code></li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full"
          size="lg"
          onClick={handleContinue}
          disabled={status !== 'success'}
          data-testid="button-continue-setup"
        >
          Continue to ARUS
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
