import type { Metadata } from "next";
import { getUploadLink } from "@/lib/hotel-eye/links";
import { createServiceClient } from "@/lib/supabase/service";
import PublicLayout from "../../s/[org]/layout";
import { IdUploadForm } from "./id-upload-form";

// The token is the whole credential: never indexed, never cached, no referrer.
export const metadata: Metadata = { title: "Upload your ID", robots: { index: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export default async function IdUploadPage({ params }: Props) {
  const { token } = await params;
  const link = await getUploadLink(createServiceClient(), token);

  return (
    <PublicLayout>
      <main id="main" className="public-main">
        <div className="public-wrap id-page">
          {link.status === "open" ? (
            <>
              <header className="chat-page-heading">
                <p className="public-eyebrow">Your stay with {link.hostName}</p>
                <h1 className="public-display">Upload your ID</h1>
              </header>
              <IdUploadForm
                token={link.token}
                hostName={link.hostName}
                propertyName={link.propertyName}
                defaultName={link.guestName}
                defaultPhone={link.guestPhone ?? ""}
                startDate={link.startDate}
                endDate={link.endDate}
              />
            </>
          ) : (
            <div className="public-not-found">
              <p className="public-eyebrow">ID upload</p>
              <h1 className="public-display">
                {link.status === "used" ? "Already received" : link.status === "expired" ? "This link has expired" : "Link not valid"}
              </h1>
              <p>
                {link.status === "used"
                  ? "Your ID has already been received. Thank you."
                  : link.status === "expired"
                    ? `Ask ${link.hostName} for a new link.`
                    : "This link isn't valid. Ask your host to send it again."}
              </p>
            </div>
          )}
        </div>
      </main>
    </PublicLayout>
  );
}
