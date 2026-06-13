// Phase 3 complete
// Added cases:
if (path === '/profile') return <MobileProfilePage />;
if (path === '/attention-inbox') return <MobileAttentionInboxPage />;
if (path === '/my-tasks') return <MobileMyTasksPage />;
// All leaky routes now map to safe mobile pages using MobilePageShell.