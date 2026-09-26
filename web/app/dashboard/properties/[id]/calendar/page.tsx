import { dashboardContext } from "../../../_lib/context";
import { listBlocks } from "@/lib/availability/blocks";
import { covers } from "@/lib/availability/dates";
import { localToday } from "@/lib/dashboard/analytics";
import { Sheet, SheetHeader } from "@/components/ui/page-header";
import { MonthGrid, type DayState } from "@/components/calendar/month-grid";
import { createBlockAction } from "../../actions";
import { BlockForm } from "./block-form";
import { BlockList } from "./block-list";

// The first of the month, n months after `month` (also the first of a month).
function addMonths(month: string, n: number): string {
  const [year, mo] = month.split("-").map(Number);
  const total = mo - 1 + n;
  const nextYear = year + Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

export default async function PropertyCalendarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await dashboardContext();
  const blocks = await listBlocks(supabase, id);
  const today = localToday();
  const currentMonth = `${today.slice(0, 7)}-01`;
  const months = [0, 1, 2].map((n) => addMonths(currentMonth, n));

  function stateFor(date: string): DayState {
    if (date < today) return "past";
    const booking = blocks.find((b) => covers(b, date));
    if (booking?.reason === "booking") return "booked";
    if (booking) return "blocked";
    return "available";
  }

  return (
    <div className="flex flex-col gap-6">
      <Sheet>
        <SheetHeader
          title="Block dates"
          description="Blocked nights can't be booked and show as unavailable on your public page."
        />
        <div className="p-5 sm:p-6">
          <BlockForm action={createBlockAction.bind(null, id)} today={today} />
        </div>
      </Sheet>

      <Sheet>
        <SheetHeader title="Next three months" />
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-3">
          {months.map((month) => (
            <MonthGrid key={month} month={month} stateFor={stateFor} />
          ))}
        </div>
      </Sheet>

      <Sheet>
        <SheetHeader title="Blocked dates" />
        <BlockList propertyId={id} blocks={blocks.filter((b) => b.end > today)} />
      </Sheet>
    </div>
  );
}
