import Link from "next/link";
import { dashboardContext } from "../_lib/context";
import { listCalendar } from "@/lib/availability/calendar";
import { addDays, isIsoDate } from "@/lib/availability/dates";
import { localToday } from "@/lib/dashboard/analytics";
import { PageHeader, Sheet } from "@/components/ui/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Timeline } from "./timeline";

const NIGHTS = 42;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { supabase, organization } = await dashboardContext();
  const { from: fromParam } = await searchParams;
  const from = fromParam && isIsoDate(fromParam) ? fromParam : localToday();
  const rows = await listCalendar(supabase, organization.id, from, NIGHTS);
  const previous = addDays(from, -NIGHTS);
  const next = addDays(from, NIGHTS);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendar"
        description="Every property, the next six weeks. Blocks and confirmed bookings together."
        actions={
          <>
            <Link href={`/dashboard/calendar?from=${previous}`} className={buttonClasses("secondary")}>
              Previous
            </Link>
            <Link href="/dashboard/calendar" className={buttonClasses("secondary")}>
              Today
            </Link>
            <Link href={`/dashboard/calendar?from=${next}`} className={buttonClasses("secondary")}>
              Next
            </Link>
          </>
        }
      />
      <Sheet>
        <Timeline from={from} nights={NIGHTS} rows={rows} />
      </Sheet>
    </div>
  );
}
