import { daysInMonth, monthStart } from "@/lib/availability/dates";

export type DayState = "available" | "blocked" | "past" | "selected" | "in-range" | "booked";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TITLE = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY_NAME = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const SELECTABLE: DayState[] = ["available", "selected", "in-range"];

// "Monday 12 October 2026" — shared by every accessible day label (stay picker, host calendar).
export function formatDayName(date: string): string {
  return DAY_NAME.format(new Date(`${date}T00:00:00Z`)).replace(", ", " ");
}

// Presentational only: the caller decides each day's state. Used by the
// host calendar and the public stay picker, so both look the same.
export function MonthGrid({
  month,
  stateFor,
  renderDay,
  onSelect,
  labelFor,
}: {
  month: string;
  stateFor: (date: string) => DayState;
  renderDay?: (date: string, state: DayState) => React.ReactNode;
  onSelect?: (date: string) => void;
  labelFor?: (date: string, state: DayState) => string;
}) {
  const first = monthStart(month);
  const count = daysInMonth(first);
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday-first
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: count }, (_, i) => `${first.slice(0, 8)}${String(i + 1).padStart(2, "0")}`),
  ];
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const title = TITLE.format(new Date(`${first}T00:00:00Z`));

  return (
    <div className="month-grid">
      <p className="month-grid-title">{title}</p>
      <div className="month-grid-weekdays" aria-hidden="true">
        {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div role="grid" aria-label={title} className="month-grid-days">
        {weeks.map((week, w) => (
          // display: contents keeps the 7-column CSS grid while giving the ARIA grid its rows.
          <div key={w} role="row" className="month-grid-row">
            {week.map((date, i) => {
              if (!date) return <span key={`pad-${i}`} className="month-grid-pad" aria-hidden="true" />;
              const state = stateFor(date);
              const content = renderDay ? renderDay(date, state) : Number(date.slice(8));
              const label = labelFor?.(date, state) ?? date;
              const interactive = onSelect && SELECTABLE.includes(state);
              return (
                <span key={date} role="gridcell" className="month-grid-cell" data-state={state} aria-label={interactive ? undefined : label}>
                  {interactive ? (
                    <button type="button" className="month-grid-day" aria-label={label} aria-pressed={state === "selected"} onClick={() => onSelect!(date)}>
                      {content}
                    </button>
                  ) : (
                    <span className="month-grid-day">{content}</span>
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
