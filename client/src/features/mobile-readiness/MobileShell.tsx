import { ReactNode } from 'react';
import { MobileReadinessBottomNav } from './MobileReadinessShared';
import { MobileReadinessRoute } from './MobileReadinessScreens';

export function MobileShell({ children, path }: { children?: ReactNode; path?: string }) {
  return (
    <div className="min-h-screen pb-20 md:pb-0"> {/* padding for fixed bottom nav */}
      <main>
        {children || <MobileReadinessRoute currentPath={path} />}
      </main>
      <MobileReadinessBottomNav />
    </div>
  );
}
