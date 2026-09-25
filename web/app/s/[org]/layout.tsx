import Link from "next/link";
import "./public.css";
import { Wordmark } from "@/components/brand/wordmark";
import { PRODUCT_NAME } from "@/lib/brand";

// Public guest pages (spec §8, "Two visual languages"): photo-led and calm,
// sharing every token with the dashboard. No host navigation, no session.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      {children}
      <footer className="public-footer public-wrap">
        <span>Booked directly with your host.</span>
        <Link href="/" className="public-footer-brand" aria-label={`${PRODUCT_NAME} home`}>
          <span>Powered by</span> <Wordmark />
        </Link>
      </footer>
    </div>
  );
}
