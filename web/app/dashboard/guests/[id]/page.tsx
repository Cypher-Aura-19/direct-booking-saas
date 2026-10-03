import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@/components/ui/icons";
import { PageHeader, Sheet } from "@/components/ui/page-header";
import { addDays } from "@/lib/availability/dates";
import { localToday } from "@/lib/dashboard/analytics";
import { retentionLabel } from "@/lib/hotel-eye/dates";
import { getRecord, recordImageUrl } from "@/lib/hotel-eye/records";
import { dashboardContext } from "../../_lib/context";
import { CopyField } from "./copy-field";
import { RetentionForm } from "./retention-form";

export const dynamic = "force-dynamic";

export default async function GuestRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await dashboardContext();
  const record = await getRecord(supabase, id);
  if (!record) notFound();
  // A fresh 60-second signed URL per render; never stored.
  const imageUrl = await recordImageUrl(supabase, record.imagePath);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dashboard/guests" className="booking-back"><IconArrowLeft /> All guest IDs</Link>
      <PageHeader title={record.guestName} description={retentionLabel(record.retentionExpiresAt, new Date())} />
      <Sheet className="p-5 sm:p-8">
        <dl className="booking-facts">
          <CopyField label="Full name" value={record.guestName} />
          <CopyField label="CNIC number" value={record.cnicNumber ?? ""} />
          <CopyField label="Phone" value={record.guestPhone ?? ""} />
          <CopyField label="Check-in" value={record.stayStart} />
          <CopyField label="Check-out" value={record.stayEnd} />
        </dl>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Guest ID" className="record-image" />
        ) : (
          <p className="booking-confirm">The image is not available.</p>
        )}
        <p className="record-note">The image link works for 60 seconds — reload the page to view it again.</p>
        <RetentionForm recordId={record.id} min={addDays(localToday(), 1)} max={addDays(record.stayEnd, 90)} />
        {record.bookingId && <p><Link href={`/dashboard/bookings/${record.bookingId}`} className="booking-link">Open the booking</Link></p>}
      </Sheet>
    </div>
  );
}
