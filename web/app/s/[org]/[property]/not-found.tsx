import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

// PUB-06: an unknown PROPERTY under a known host is a different situation
// from an unknown host ([org]/not-found.tsx) — the org slug resolved fine,
// only this property's slug didn't — so it gets its own, place-appropriate
// copy instead of inheriting "We couldn't find that host."
export default function PublicPropertyNotFound() {
  return (
    <main id="main" className="public-main public-wrap public-not-found">
      <p className="public-eyebrow">Page not found</p>
      <h1 className="public-display">We couldn&apos;t find that place.</h1>
      <p>The link may have a typo, or this place may no longer be listed. Ask the host to send it again.</p>
      <Link href="/" className={buttonClasses("secondary")}>Go to the home page</Link>
    </main>
  );
}
