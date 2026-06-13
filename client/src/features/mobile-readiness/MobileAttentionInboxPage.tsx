import { MobilePageShell } from './MobilePageShell';

export function MobileAttentionInboxPage() {
  return (
    <MobilePageShell>
      <div className="p-4">
        <h2 className="font-semibold">Attention Inbox - Mobile Version</h2>
        <p>Priority items and notifications handled in mobile-friendly UI.</p>
        <div className="mt-4 space-y-3">
          {/* Mock cards */}
          <div className="bg-white p-3 rounded">Vessel Alert 1</div>
          <div className="bg-white p-3 rounded">Work Order Reminder</div>
        </div>
      </div>
    </MobilePageShell>
  );
}