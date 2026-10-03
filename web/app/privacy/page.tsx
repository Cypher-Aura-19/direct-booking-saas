import type { Metadata } from "next";
import PublicLayout from "../s/[org]/layout";

export const metadata: Metadata = { title: "Privacy policy" };

// DRAFT. The retention period and legal basis are assumptions pending legal
// review (spec D-11 / O-01). The banner stays until that review is done.
export default function PrivacyPage() {
  return (
    <PublicLayout>
      <main id="main" className="public-main">
        <div className="public-wrap id-page">
          <p className="id-draft-banner" role="note">Draft — pending legal review. Wording may change before launch.</p>
          <header className="chat-page-heading">
            <p className="public-eyebrow">Privacy</p>
            <h1 className="public-display">How your ID is handled</h1>
          </header>
          <section className="id-policy">
            <h2>What we collect</h2>
            <p>A photo of your national ID, your name, your ID number, your phone number and your stay dates.</p>
            <h2>Why</h2>
            <p>Hosts in Pakistan are required to register the identity of guests who stay with them. Your host uses these details to complete that registration.</p>
            <h2>Who can see it</h2>
            <p>Only your host. The photo is stored privately and is shown to your host through a link that stops working after a minute. It is never shown on public pages or back to you.</p>
            <h2>How long we keep it</h2>
            <p>Automatically deleted 90 days after your check-out date, photo included. Your host can only shorten that period, never extend it.</p>
            <h2>Questions or removal</h2>
            <p>Contact your host directly.</p>
          </section>
        </div>
      </main>
    </PublicLayout>
  );
}
