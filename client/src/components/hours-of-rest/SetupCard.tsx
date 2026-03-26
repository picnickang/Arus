import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";
import { FatigueRiskBadge } from "@/components/crew/FatigueRiskBadge";
import { type Crew, type Vessel, MONTHS, type HoursOfRestMeta } from "@/features/crew";

interface SetupCardProps {
  meta: HoursOfRestMeta;
  setMeta: React.Dispatch<React.SetStateAction<HoursOfRestMeta>>;
  vessels: Vessel[];
  crew: Crew[];
  filteredCrew: Crew[];
  isVesselSelected: boolean;
  isReadyForActions: boolean;
}

export function SetupCard({ meta, setMeta, vessels, crew, filteredCrew, isVesselSelected, isReadyForActions }: SetupCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Setup</CardTitle>
        <CardDescription>Select vessel and crew member to view or edit their hours of rest</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="vessel-select" className="text-base font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm">1</span>
              Select Vessel
            </Label>
            <Select value={meta.vessel_id || "all"} onValueChange={(value) => setMeta({ ...meta, vessel_id: value, crew_id: "" })}>
              <SelectTrigger data-testid="select-vessel-grid" className="h-11"><SelectValue placeholder="Choose a vessel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels (includes unassigned crew)</SelectItem>
                {vessels.filter((v: Vessel) => v.id).map((vessel: Vessel) => <SelectItem key={vessel.id} value={vessel.id}>{vessel.name} ({vessel.type})</SelectItem>)}
              </SelectContent>
            </Select>
            {!isVesselSelected && <p className="text-sm text-muted-foreground flex items-start gap-2"><span>Select a vessel or "All Vessels" to view crew members</span></p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="crew-select" className="text-base font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm">2</span>
              Select Crew Member
            </Label>
            <Select value={meta.crew_id} onValueChange={(value) => setMeta({ ...meta, crew_id: value })} disabled={!isVesselSelected}>
              <SelectTrigger data-testid="select-crew-grid" className={`h-11 ${!isVesselSelected ? "opacity-50 cursor-not-allowed" : ""}`}>
                <SelectValue placeholder={!isVesselSelected ? "Select vessel first" : "Choose a crew member"} />
              </SelectTrigger>
              <SelectContent>{filteredCrew.map((member: Crew) => <SelectItem key={member.id} value={member.id}>{member.name} - {member.rank}</SelectItem>)}</SelectContent>
            </Select>
            {!isVesselSelected && <p className="text-sm text-muted-foreground">Crew selection will be available after choosing a vessel</p>}
            {isVesselSelected && filteredCrew.length === 0 && <p className="text-sm text-amber-600 dark:text-amber-400">No crew members found for this vessel</p>}
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm">3</span>
              Select Time Period
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-normal">Month</Label>
                <Select value={meta.month} onValueChange={(value) => setMeta({ ...meta, month: value })}>
                  <SelectTrigger data-testid="select-month-grid"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m) => <SelectItem key={m.label} value={m.label}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-normal">Year</Label>
                <Input type="number" placeholder="Year" value={meta.year || 2025} onChange={(e) => setMeta({ ...meta, year: Number(e.target.value) || 2025 })} data-testid="input-year-grid" />
              </div>
            </div>
          </div>

          {isReadyForActions && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg" data-testid="ready-indicator">
              <div className="flex items-center justify-between">
                <p className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Ready to edit hours of rest for <strong>{crew.find((c) => c.id === meta.crew_id)?.name}</strong> ({meta.month} {meta.year})</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Fatigue Risk:</span>
                  <FatigueRiskBadge crewId={meta.crew_id} crewName={crew.find((c) => c.id === meta.crew_id)?.name} showScore />
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
