import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Users,
  User,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import {
  type CrewMember,
  type Vessel,
} from "@/features/crew/hooks/useSchedulePlannerData";
import { cn } from "@/lib/utils";
import {
  getRoleColor,
} from "../schedule-planner-utils";




export function MobileCrewRosterDrawer({
  crew,
  vessels,
  isOpen,
  onClose,
  onSelectCrew,
}: {
  crew: CrewMember[];
  vessels: Vessel[];
  isOpen: boolean;
  onClose: () => void;
  onSelectCrew: (crewMember: CrewMember) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [rankFilter, setRankFilter] = useState<string | null>(null);
  const [availabilityFilter, setAvailabilityFilter] = useState<string | null>(null);

  const uniqueRanks = useMemo(() => {
    const ranks = new Set<string>();
    crew.forEach((c) => ranks.add(c.rank));
    return Array.from(ranks).sort();
  }, [crew]);

  const filteredCrew = useMemo(() => {
    return crew.filter((c) => {
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (rankFilter && c.rank !== rankFilter) {
        return false;
      }
      if (availabilityFilter) {
        const status = c.availability || (c.onLeave ? "leave" : "available");
        if (status !== availabilityFilter) {
          return false;
        }
      }
      return c.active;
    });
  }, [crew, searchQuery, rankFilter, availabilityFilter]);

  const getVesselName = (vesselId?: string) => {
    if (!vesselId) {
      return "Unassigned";
    }
    const vessel = vessels.find((v) => v.id === vesselId);
    return vessel?.name || "Unknown Vessel";
  };

  const getAvailabilityBadge = (member: CrewMember) => {
    const status = member.availability || (member.onLeave ? "leave" : "available");
    switch (status) {
      case "available":
        return (
          <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]">
            Available
          </Badge>
        );
      case "on_duty":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600 text-[10px]">
            On Duty
          </Badge>
        );
      case "leave":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-600 text-[10px]">
            On Leave
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="text-muted-foreground text-[10px]">
            Pending
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[70vh] p-0 rounded-t-xl">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Crew Roster
          </SheetTitle>
        </SheetHeader>

        <div className="p-3 border-b space-y-3">
          <Input
            placeholder="Search crew by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
            data-testid="input-crew-search"
          />
          <div className="flex gap-2">
            <Select
              value={rankFilter || "__all__"}
              onValueChange={(v) => setRankFilter(v === "__all__" ? null : v)}
            >
              <SelectTrigger className="flex-1 h-9" data-testid="select-rank-filter">
                <SelectValue placeholder="All Ranks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Ranks</SelectItem>
                {uniqueRanks.map((rank) => (
                  <SelectItem key={rank} value={rank}>
                    {rank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={availabilityFilter || "__all__"}
              onValueChange={(v) => setAvailabilityFilter(v === "__all__" ? null : v)}
            >
              <SelectTrigger className="flex-1 h-9" data-testid="select-availability-filter">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="on_duty">On Duty</SelectItem>
                <SelectItem value="leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="h-[calc(70vh-180px)]">
          {filteredCrew.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <User className="h-8 w-8 mb-2" />
              <p className="text-sm">No crew members found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredCrew.map((member) => (
                <button
                  key={member.id}
                  className="w-full text-left p-3 hover-elevate active-elevate-2 flex items-center gap-3"
                  onClick={() => {
                    onSelectCrew(member);
                    onClose();
                  }}
                  data-testid={`crew-item-${member.id}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={cn("text-white text-xs", getRoleColor(member.rank))}>
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{member.name}</span>
                      {getAvailabilityBadge(member)}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>{member.rank}</span>
                      <span className="text-muted-foreground/50">|</span>
                      <span className="truncate">{getVesselName(member.vesselId)}</span>
                    </div>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t bg-muted/30 text-xs text-muted-foreground text-center">
          {filteredCrew.length} of {crew.filter((c) => c.active).length} crew members
        </div>
      </SheetContent>
    </Sheet>
  );
}

