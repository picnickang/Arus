import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle, Anchor, Server, ArrowRight, ArrowLeft, Ship, Lock, Eye, EyeOff } from 'lucide-react';
import { testBackendConnection, setBackendUrl, getBackendUrlSync, setVesselId, setVesselName } from '@/lib/desktopFetch';

interface DesktopSetupProps {
  onComplete: () => void;
}

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';
type SetupStep = 'backend' | 'vessel' | 'admin';

interface Vessel {
  id: string;
  name: string;
  imo?: string;
  vesselType?: string;
  active?: boolean;
}

interface AdminStatus {
  configured: boolean;
}

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6" data-testid="step-indicator">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i < current
                  ? 'bg-primary text-primary-foreground'
                  : i === current
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
                  : 'bg-muted text-muted-foreground'
              }`}
              data-testid={`step-dot-${i}`}
            >
              {i < current ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:inline ${i === current ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${i < current ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function BackendStep({
  onNext,
}: {
  onNext: (url: string) => void;
}) {
  const existing = getBackendUrlSync();
  const [url, setUrl] = useState(existing || 'http://localhost:5000');
  const [status, setStatus] = useState<ConnectionStatus>(existing ? 'success' : 'idle');
  const [statusMessage, setStatusMessage] = useState(existing ? 'Using saved connection' : '');
  const [testedUrl, setTestedUrl] = useState(existing || '');

  async function handleTest() {
    if (!url.trim()) return;
    setStatus('testing');
    setStatusMessage('Testing connection...');
    const result = await testBackendConnection(url.trim());
    if (result.ok) {
      setStatus('success');
      setStatusMessage(result.message);
      setTestedUrl(url.trim());
    } else {
      setStatus('error');
      setStatusMessage(result.message);
      setTestedUrl('');
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
          Enter the URL of your ARUS backend server. For vessel deployments, this is typically the local server address.
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
                if (status !== 'idle') {
                  setStatus('idle');
                  setTestedUrl('');
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleTest()}
            />
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={status === 'testing' || !url.trim()}
              data-testid="button-test-connection"
            >
              {status === 'testing' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
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

        <Button
          className="w-full"
          onClick={() => onNext(testedUrl)}
          disabled={status !== 'success' || !testedUrl}
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
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selectedName, setSelectedName] = useState('');

  useEffect(() => {
    async function fetchVessels() {
      try {
        const res = await fetch(`${backendUrl}/api/vessels`, {
          headers: { 'x-org-id': 'default-org-id' },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        const vesselList = Array.isArray(data) ? data : data.vessels || [];
        setVessels(vesselList.filter((v: Vessel) => v.active !== false));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(`Could not load vessels: ${msg}`);
      } finally {
        setLoading(false);
      }
    }
    fetchVessels();
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
          Choose which vessel this desktop installation is associated with. This determines which equipment and telemetry data you see.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground" data-testid="loading-vessels">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading vessels...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm p-3 rounded-md bg-destructive/10 text-destructive" data-testid="text-vessel-error">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && vessels.length === 0 && (
          <div className="text-center py-6 text-muted-foreground" data-testid="text-no-vessels">
            <Ship className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No vessels found. You can add vessels after setup from the Fleet management page.</p>
          </div>
        )}

        {!loading && vessels.length > 0 && (
          <div className="grid gap-2 max-h-60 overflow-y-auto" data-testid="vessel-list">
            {vessels.map((v) => (
              <button
                key={v.id}
                onClick={() => handleSelect(v)}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                  selectedId === v.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-muted/50'
                }`}
                data-testid={`button-vessel-${v.id}`}
              >
                <Ship className={`h-5 w-5 flex-shrink-0 ${selectedId === v.id ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{v.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {v.imo && <span>IMO: {v.imo}</span>}
                    {v.imo && v.vesselType && <span> · </span>}
                    {v.vesselType && <span>{v.vesselType}</span>}
                  </div>
                </div>
                {selectedId === v.id && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
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
            {vessels.length === 0 ? 'Skip' : 'Next'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminStep({
  backendUrl,
  onNext,
  onBack,
}: {
  backendUrl: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch(`${backendUrl}/api/admin/auth/status`, {
          headers: { 'x-org-id': 'default-org-id' },
        });
        if (res.ok) {
          const data = await res.json();
          setAdminStatus(data);
        } else {
          setAdminStatus({ configured: true });
        }
      } catch {
        setAdminStatus({ configured: true });
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, [backendUrl]);

  async function handleSetup() {
    if (!password || password.length < 8) {
      setStatus('error');
      setStatusMessage('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setStatus('error');
      setStatusMessage('Passwords do not match');
      return;
    }

    setStatus('testing');
    setStatusMessage('Setting up admin access...');

    try {
      const res = await fetch(`${backendUrl}/api/admin/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': 'default-org-id' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setStatus('success');
        setStatusMessage('Admin password configured successfully');
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.code === 'ALREADY_CONFIGURED') {
          setStatus('success');
          setStatusMessage('Admin password was already configured');
        } else {
          setStatus('error');
          setStatusMessage(data.error || 'Failed to set admin password');
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setStatus('error');
      setStatusMessage(`Connection error: ${msg}`);
    }
  }

  async function handleVerify() {
    if (!password) return;
    setStatus('testing');
    setStatusMessage('Verifying password...');

    try {
      const res = await fetch(`${backendUrl}/api/admin/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': 'default-org-id' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setStatus('success');
        setStatusMessage('Admin access verified');
      } else {
        setStatus('error');
        setStatusMessage('Incorrect password');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setStatus('error');
      setStatusMessage(`Connection error: ${msg}`);
    }
  }

  const isNewSetup = adminStatus && !adminStatus.configured;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          {loading ? 'Admin Access' : isNewSetup ? 'Set Admin Password' : 'Verify Admin Access'}
        </CardTitle>
        <CardDescription>
          {loading
            ? 'Checking admin configuration...'
            : isNewSetup
            ? 'Create an admin password to secure system settings and critical operations.'
            : 'Enter your admin password to verify access. You can skip this step and unlock admin later.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Checking configuration...
          </div>
        )}

        {!loading && (
          <>
            <div className="space-y-2">
              <Label htmlFor="admin-password">{isNewSetup ? 'New Password' : 'Password'}</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  data-testid="input-admin-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isNewSetup ? 'Minimum 8 characters' : 'Enter admin password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (status !== 'idle') setStatus('idle');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (isNewSetup ? handleSetup() : handleVerify())}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {isNewSetup && (
              <div className="space-y-2">
                <Label htmlFor="admin-confirm-password">Confirm Password</Label>
                <Input
                  id="admin-confirm-password"
                  data-testid="input-admin-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (status !== 'idle') setStatus('idle');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSetup()}
                />
              </div>
            )}

            {status !== 'idle' && status !== 'testing' && (
              <div
                className={`flex items-center gap-2 text-sm p-3 rounded-md ${
                  status === 'success'
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-destructive/10 text-destructive'
                }`}
                data-testid="text-admin-status"
              >
                {status === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                )}
                {statusMessage}
              </div>
            )}

            {status !== 'success' && (
              <Button
                className="w-full"
                variant="outline"
                onClick={isNewSetup ? handleSetup : handleVerify}
                disabled={status === 'testing' || !password}
                data-testid="button-admin-action"
              >
                {status === 'testing' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {isNewSetup ? 'Set Password' : 'Verify'}
              </Button>
            )}
          </>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onBack} data-testid="button-back-admin">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={onNext}
            disabled={loading}
            data-testid="button-finish-setup"
          >
            {status === 'success' || (!isNewSetup && status === 'idle')
              ? 'Finish Setup'
              : isNewSetup
              ? 'Skip for Now'
              : 'Skip'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DesktopSetup({ onComplete }: DesktopSetupProps) {
  const [step, setStep] = useState<SetupStep>('backend');
  const [backendUrl, setConnectedUrl] = useState('');

  const stepIndex = step === 'backend' ? 0 : step === 'vessel' ? 1 : 2;
  const stepLabels = ['Connection', 'Vessel', 'Admin'];

  function handleBackendNext(url: string) {
    setBackendUrl(url);
    setConnectedUrl(url);
    setStep('vessel');
  }

  function handleVesselNext(vesselIdVal: string, vesselNameVal: string) {
    if (vesselIdVal) {
      setVesselId(vesselIdVal);
      setVesselName(vesselNameVal);
    } else {
      localStorage.removeItem('arus-vessel-id');
      localStorage.removeItem('arus-vessel-name');
    }
    setStep('admin');
  }

  function handleFinish() {
    onComplete();
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="desktop-setup-page">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
            <Anchor className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-setup-title">ARUS Setup</h1>
          <p className="text-muted-foreground text-sm">Configure your desktop application</p>
        </div>

        <StepIndicator current={stepIndex} steps={stepLabels} />

        {step === 'backend' && <BackendStep onNext={handleBackendNext} />}
        {step === 'vessel' && (
          <VesselStep
            backendUrl={backendUrl}
            onNext={handleVesselNext}
            onBack={() => setStep('backend')}
          />
        )}
        {step === 'admin' && (
          <AdminStep
            backendUrl={backendUrl}
            onNext={handleFinish}
            onBack={() => setStep('vessel')}
          />
        )}
      </div>
    </div>
  );
}
