"use client";

import type { RoomEventSummary } from "@cosmere/shared";
import { describeEvent, formatEventTime } from "./labels";

export function EventLog({
  events,
  cardTextByPosition,
  currentGameId
}: {
  events: RoomEventSummary[];
  cardTextByPosition: Map<number, string> | null;
  currentGameId: string | null;
}) {
  return (
    <div className="nice-scroll max-h-72 space-y-1.5 overflow-y-auto pr-1">
      {events.length ? (
        events.map((event) => {
          const text = describeEvent(event, cardTextByPosition, currentGameId);
          if (!text) return null;
          return (
            <div key={event.id} className="flex items-baseline gap-2 text-xs leading-relaxed">
              <span className="shrink-0 tabular-nums text-white/30">{formatEventTime(event.createdAt)}</span>
              <span className="min-w-0 break-words text-white/70">{text}</span>
            </div>
          );
        })
      ) : (
        <p className="text-xs text-white/40">还没有操作记录。</p>
      )}
    </div>
  );
}
