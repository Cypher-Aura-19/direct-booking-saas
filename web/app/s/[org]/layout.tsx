import Link from "next/link";
import "./public.css";
import { PRODUCT_NAME } from "@/lib/brand";

// Public guest pages (spec §8, "Two visual languages"): photo-led and calm,
// sharing every token with the dashboard. No host navigation, no session.
//
// The footer brand is plain text, not <Wordmark />: the wordmark's seal
// draws the Urdu letter ق as live SVG text in Noto Nastaliq, which would
// pull the ~240KB Arabic font subset onto every public page for one
// glyph. The dashboard and marketing pages still use the full seal.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      {children}
      <footer className="public-footer public-wrap">
        <span>Booked directly with your host.</span>
        <Link href="/" className="public-footer-brand" aria-label={`${PRODUCT_NAME} home`}>
          <span>Powered by</span> <span className="text-[19px] font-semibold tracking-[-0.02em] text-ink">{PRODUCT_NAME}</span>
        </Link>
      </footer>
    </div>
  );
}
