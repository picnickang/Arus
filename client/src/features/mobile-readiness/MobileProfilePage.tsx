import { MobilePageShell } from './MobilePageShell';
import { MobilePageHeader } from './MobileReadinessShared';

export function MobileProfilePage() {
  return (
    <MobilePageShell>
      <MobilePageHeader title="Profile" />
      <div className="space-y-4 p-4">
        <div className="bg-white rounded-xl p-4 shadow">
          <p className="text-lg font-medium">User Profile - Mobile Optimized</p>
          <p>Role-specific content here. No legacy card layout.</p>
        </div>
        <button className="w-full py-3 bg-blue-600 text-white rounded-xl">My Tasks (Safe)</button>
        <button className="w-full py-3 bg-gray-200">Settings</button>
      </div>
    </MobilePageShell>
  );
}