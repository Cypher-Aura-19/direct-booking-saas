import { NextResponse } from "next/server";
import { recordsToCsv } from "@/lib/hotel-eye/csv";
import { listRecords, parseRange } from "@/lib/hotel-eye/records";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The host's own session: RLS means only their organisation's records can be
// exported. CSV only — never any image data.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const range = parseRange(url.searchParams.get("from"), url.searchParams.get("to"));
  const csv = recordsToCsv(await listRecords(supabase, range));
  const name = `guest-ids${range.from ? `-from-${range.from}` : ""}${range.to ? `-to-${range.to}` : ""}.csv`;
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
}
