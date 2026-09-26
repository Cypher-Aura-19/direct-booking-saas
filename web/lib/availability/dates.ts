// Dates are ISO YYYY-MM-DD strings and ranges are nights: [start, end), with end
// the checkout morning. All arithmetic is at UTC midnight, so a timezone or DST
// shift can never move a date.
export type DateRange = { start: string; end: string };

const DAY = 86_400_000;
const toMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  return fromMs(toMs(date) + days * DAY);
}

export function nightsBetween(start: string, end: string): number {
  return Math.round((toMs(end) - toMs(start)) / DAY);
}

export function eachNight(range: DateRange): string[] {
  const nights: string[] = [];
  for (let d = range.start; d < range.end; d = addDays(d, 1)) nights.push(d);
  return nights;
}

export function covers(range: DateRange, night: string): boolean {
  return range.start <= night && night < range.end;
}

export function overlaps(a: DateRange, b: DateRange): boolean {
  return a.start < b.end && b.start < a.end;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = toMs(value);
  return !Number.isNaN(ms) && fromMs(ms) === value;
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function daysInMonth(month: string): number {
  const start = monthStart(month);
  const [y, m] = start.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return nightsBetween(start, next);
}
