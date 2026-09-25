import { dashboardContext } from './_lib/context';
import { DashboardHome } from './dashboard-home';
import { localToday, shiftDate, type Booking, type DashboardProperty } from '@/lib/dashboard/analytics';

export default async function DashboardPage() {
  const { supabase, organization } = await dashboardContext();
  const today = localToday();
  const properties: DashboardProperty[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('properties').select('id,name,published').eq('organization_id', organization.id).order('id').range(offset, offset + 999);
    if (error) throw error;
    properties.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const bookings: Booking[] = [];
  let escalatedCount = 0;
  // RLS and the organization join both scope these reads. Paginate to avoid silently truncated analytics.
  if (properties.length) {
    const cutoff = shiftDate(today, -180);
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from('bookings').select('id,property_id,start_date,end_date,status,total_price_cents,created_at,properties!inner(organization_id)')
        .eq('properties.organization_id', organization.id)
        .or(`created_at.gte.${cutoff},end_date.gte.${cutoff},status.eq.requested`).order('id').range(offset, offset + 999);
      if (error) throw error;
      bookings.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const { count, error } = await supabase.from('conversations').select('id,properties!inner(organization_id)', { count: 'exact', head: true }).eq('properties.organization_id', organization.id).eq('escalated', true);
    if (error) throw error;
    escalatedCount = count ?? 0;
  }
  return <DashboardHome bookings={bookings} properties={properties} today={today} organizationName={organization.name} escalatedCount={escalatedCount} />;
}
