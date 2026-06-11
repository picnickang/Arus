import { eventTypeLabel, type CrewTaskEventView } from "@/features/crew";

export function ActivityEntry({ event }: { event: CrewTaskEventView }) {
  const when = event.createdAt ? new Date(event.createdAt).toLocaleString() : "";
  const isComment = event.eventType === "comment";
  return (
    <li className="flex gap-2 text-sm" data-testid={`event-${event.id}`}>
      <div
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
          isComment ? "bg-sky-400" : "bg-slate-500"
        }`}
      />
      <div className="min-w-0">
        <p className="text-slate-200">
          {!isComment && (
            <span className="mr-1 font-medium text-slate-400">
              {eventTypeLabel(event.eventType)}:
            </span>
          )}
          {event.message}
        </p>
        <p className="text-[11px] text-slate-500">
          {event.actorName ? `${event.actorName} · ` : ""}
          {when}
        </p>
      </div>
    </li>
  );
}
