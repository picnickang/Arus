import { useEffect } from "react";
import { HoursOfRestGrid } from "@/components/HoursOfRestGrid";
import { PermissionGate, PagePermissionDenied } from "@/components/PermissionGate";
import { PageHeader } from "@/components/navigation";
import { useToast } from "@/hooks/use-toast";

export default function HoursOfRestPage() {
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "record") {
      toast({ title: "Record Rest Hours", description: "Select a crew member and tap the grid cells to record rest and work periods." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <PermissionGate resource="rest_hours" action="view" fallback={<PagePermissionDenied />}>
      <div className="min-h-screen">
        <PageHeader title="Hours of Rest" />
        <div className="p-6">
          <HoursOfRestGrid />
        </div>
      </div>
    </PermissionGate>
  );
}
