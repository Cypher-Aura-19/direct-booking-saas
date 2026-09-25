import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

// PUB-06: a written page, not a blank 404.
export default function PublicNotFound() {
  return (
    <main id="main" className="public-main public-wrap public-not-found">
      <p className="public-eyebrow">Page not found</p>
      <h1 className="public-display">We couldn&apos;t find that host.</h1>
      <p>The link may have a typo, or the host may have changed their page address. Ask them to send it again.</p>
      <Link href="/" className={buttonClasses("secondary")}>Go to the home page</Link>
    </main>
  );
}
