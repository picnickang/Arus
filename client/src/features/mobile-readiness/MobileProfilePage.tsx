// Polished version with better styling, icons, and mobile touch-friendly buttons
export function MobileProfilePage() {
  return (
    <MobilePageShell title="My Profile">
      <div className="space-y-6">
        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <h3 className="font-semibold">Captain Nick Tan</h3>
              <p className="text-sm text-muted-foreground">Chief Engineer • MV Pacific Star</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">👷</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button className="py-3 bg-blue-600 text-white rounded-xl active:bg-blue-700">My Tasks</button>
          <button className="py-3 border rounded-xl active:bg-gray-100">Availability</button>
        </div>

        <button className="w-full py-3 border rounded-xl text-red-600">Logout</button>
      </div>
    </MobilePageShell>
  );
}