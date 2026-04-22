import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

interface ScheduledAssignment {
  crewId: string;
  vesselId?: string;
  role?: string;
  date: string;
  start: string;
  end: string;
}

interface CrewMember {
  id: string;
  name: string;
  rank?: string;
}

interface FairnessVizProps {
  scheduled: ScheduledAssignment[];
  crew: CrewMember[];
}

export default function FairnessViz({ scheduled, crew }: FairnessVizProps) {
  const crewShiftCounts = crew
    .map((member) => {
      const count = scheduled.filter((s) => s.crewId === member.id).length;
      return { ...member, shiftCount: count };
    })
    .sort((a, b) => b.shiftCount - a.shiftCount);

  const maxShifts = Math.max(...crewShiftCounts.map((c) => c.shiftCount), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          Workload Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {crewShiftCounts.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3"
              data-testid={`fairness-row-${member.id}`}
            >
              <span className="text-sm w-32 truncate">{member.name}</span>
              <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/70 rounded-full transition-all"
                  style={{ width: `${(member.shiftCount / maxShifts) * 100}%` }}
                />
              </div>
              <Badge variant="outline" className="text-xs min-w-[40px] justify-center">
                {member.shiftCount}
              </Badge>
            </div>
          ))}
          {crewShiftCounts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No assignments to display
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
