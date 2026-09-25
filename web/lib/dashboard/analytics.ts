export type Booking = {
  id: string; property_id: string; start_date: string; end_date: string;
  status: string; total_price_cents: number; created_at: string;
};
export type DashboardProperty = { id: string; name: string; published: boolean };
const CONFIRMED = new Set(['approved', 'paid', 'staying', 'checked_out']);
export const DAY = 86_400_000;
export function localToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(date + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);
}
export function bookingDay(booking: Booking) { return localToday(new Date(booking.created_at)); }
export function summarize(bookings: Booking[], properties: DashboardProperty[], today: string, days: number, propertyId = 'all') {
  const selected = properties.filter(p => propertyId === 'all' || p.id === propertyId);
  const ids = new Set(selected.map(p => p.id));
  const rows = bookings.filter(b => ids.has(b.property_id));
  const start = shiftDate(today, 1 - days);
  const previousStart = shiftDate(start, -days);
  const current = rows.filter(b => bookingDay(b) >= start && bookingDay(b) <= today);
  const previous = rows.filter(b => bookingDay(b) >= previousStart && bookingDay(b) < start);
  const value = (list: Booking[]) => list.filter(b => CONFIRMED.has(b.status)).reduce((sum, b) => sum + b.total_price_cents, 0);
  // Count unique property nights, not booking rows: overlapping reservations must not exceed 100%.
  const occupied = new Set<string>();
  for (const b of rows.filter(b => CONFIRMED.has(b.status))) {
    for (let date = b.start_date < start ? start : b.start_date; date < b.end_date && date <= today; date = shiftDate(date, 1)) occupied.add(b.property_id + ':' + date);
  }
  const bucketSize = Math.ceil(days / 12);
  const buckets: { date: string; end: string; value: number; count: number }[] = [];
  for (let i = 0; i < days; i += bucketSize) {
    const date = shiftDate(start, i), end = shiftDate(start, Math.min(i + bucketSize - 1, days - 1));
    const group = current.filter(b => bookingDay(b) >= date && bookingDay(b) <= end);
    buckets.push({ date, end, value: value(group), count: group.length });
  }
  const status = [
    { label: 'Requested', count: current.filter(b => b.status === 'requested').length, color: '#a9de59' },
    { label: 'Confirmed', count: current.filter(b => CONFIRMED.has(b.status)).length, color: '#365b28' },
    { label: 'Rejected', count: current.filter(b => b.status === 'rejected').length, color: '#c6cebd' },
  ];
  return { start, bookings: current.length, previousBookings: previous.length, value: value(current), previousValue: value(previous), occupancy: selected.length ? Math.round(occupied.size / (selected.length * days) * 100) : 0, occupiedNights: occupied.size, properties: selected.length, published: selected.filter(p => p.published).length, buckets, status,
    upcoming: rows.filter(b => ['approved', 'paid', 'staying'].includes(b.status) && b.end_date > today).sort((a,b) => a.start_date.localeCompare(b.start_date)).slice(0,5),
    recent: [...current].sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,5),
    performance: selected.map(p => ({ ...p, count: current.filter(b => b.property_id === p.id).length, value: value(current.filter(b => b.property_id === p.id)) })).sort((a,b) => b.value - a.value).slice(0,4),
  };
}
