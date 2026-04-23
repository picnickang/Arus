import { SVG_H, SVG_W } from "./constants";
import { HullSVG } from "./HullSVG";
import { SlotRect } from "./SlotRect";
import type { SlotAssignment, ZoneRect } from "./types";

export function VesselSchematic({
  slotAssignments,
  zoneRects,
  selectedSlotId,
  onSelectSlot,
}: {
  slotAssignments: SlotAssignment[];
  zoneRects: ZoneRect[];
  selectedSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
}) {
  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-full min-h-[240px] sm:min-h-[320px]">
      <HullSVG zoneRects={zoneRects} />
      {slotAssignments.map((assignment) => (
        <SlotRect
          key={assignment.slot.slotId}
          assignment={assignment}
          isSelected={selectedSlotId === assignment.slot.slotId}
          onClick={() => onSelectSlot(assignment.slot.slotId)}
        />
      ))}
    </svg>
  );
}
