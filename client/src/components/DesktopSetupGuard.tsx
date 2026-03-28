import { useEffect, useState, ReactNode } from 'react';
import { useLocation }                    from 'wouter';
import { isDesktop }                      from '@/lib/desktop';
import { isDesktopSetupComplete }         from '@/lib/desktopFetch';

type GuardState = 'checking' | 'ready' | 'needs-setup';

interface Props {
  children: ReactNode;
}

export default function DesktopSetupGuard({ children }: Props) {
  const [, navigate]  = useLocation();
  const [state, setState] = useState<GuardState>(
    isDesktop() ? 'checking' : 'ready'
  );

  useEffect(() => {
    if (!isDesktop()) return;

    let cancelled = false;

    isDesktopSetupComplete().then(complete => {
      if (cancelled) return;
      if (complete) {
        setState('ready');
      } else {
        setState('needs-setup');
        navigate('/setup', { replace: true });
      }
    });

    return () => { cancelled = true; };
  }, []);

  if (state === 'checking') {
    return <LoadingScreen />;
  }

  if (state === 'needs-setup') {
    return null;
  }

  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-2xl font-bold text-white tracking-tight">ARUS</div>
        <div className="flex justify-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <p className="text-slate-500 text-sm">Starting…</p>
      </div>
    </div>
  );
}
