import Link from "next/link";
import { addDays, nightsBetween } from "@/lib/availability/dates";
import { localToday } from "@/lib/dashboard/analytics";
import type { CalendarRow } from "@/lib/availability/calendar";

const WEEKDAY_INITIAL = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const LABEL_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function labelDate(date: string): string {
  return LABEL_DATE.format(new Date(`${date}T00:00:00Z`));
}

// CAL-03: a server-safe, horizontally scrollable grid. A sticky first column
// holds property names; one 44px column per night follows. Blocks and
// confirmed bookings render as bars clipped to the visible window.
export function Timeline({ from, nights, rows }: { from: string; nights: number; rows: CalendarRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="calendar-empty">
        <p>Add a property to see its calendar here.</p>
        <Link href="/dashboard/properties/new">Add a property</Link>
      </div>
    );
  }

  const today = localToday();
  const to = addDays(from, nights);
  const dates = Array.from({ length: nights }, (_, i) => addDays(from, i));
  const gridStyle = { gridTemplateColumns: `repeat(${nights}, 44px)` };

  return (
    <div className="calendar-timeline-wrap">
      <div className="calendar-timeline">
        <div className="calendar-row calendar-row-header">
          <div className="calendar-cell-sticky calendar-cell-corner" />
          <div className="calendar-track calendar-track-header" style={gridStyle}>
            {dates.map((date) => (
              <div key={date} className={`calendar-daycell calendar-daycell-header ${date === today ? "is-today" : ""}`}>
                <span>{WEEKDAY_INITIAL.format(new Date(`${date}T00:00:00Z`)).charAt(0)}</span>
                <strong>{Number(date.slice(8))}</strong>
              </div>
            ))}
          </div>
        </div>
        {rows.map((row) => (
          <div key={row.propertyId} className="calendar-row">
            <div className="calendar-cell-sticky calendar-cell-property">{row.propertyName}</div>
            <div className="calendar-track" style={gridStyle}>
              {dates.map((date) => (
                <div key={date} className={`calendar-daycell ${date === today ? "is-today" : ""}`} />
              ))}
              {row.entries.map((entry, index) => {
                const start = entry.start < from ? from : entry.start;
                const end = entry.end > to ? to : entry.end;
                if (end <= start) return null;
                const startIndex = nightsBetween(from, start);
                const span = nightsBetween(start, end);
                const label = `${row.propertyName}: ${entry.label} ${labelDate(start)} – ${labelDate(addDays(end, -1))}`;
                return (
                  <div
                    key={`${row.propertyId}-${index}`}
                    className={`calendar-bar calendar-bar-${entry.kind}`}
                    style={{ gridColumnStart: startIndex + 1, gridColumnEnd: startIndex + 1 + span }}
                    role="group"
                    aria-label={label}
                    title={label}
                  >
                    {entry.label}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
