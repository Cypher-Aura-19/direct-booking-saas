import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deleteExpired } from "@/lib/hotel-eye/retention";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

function authorised(header: string | null, secret: string | undefined): boolean {
  if (!secret) return false; // never open when the secret isn't configured
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
// set in the project's environment. A non-2xx is returned if any record
// failed, so the failure shows in Vercel's cron log; the job is idempotent,
// so the next run retries.
export async function GET(request: Request) {
  if (!authorised(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const result = await deleteExpired(createServiceClient());
  return NextResponse.json(result, { status: result.failed > 0 ? 500 : 200 });
}
