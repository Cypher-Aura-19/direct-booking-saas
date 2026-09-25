import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

import { PRODUCT_NAME } from "@/lib/brand";

type Scene = {
  src: StaticImageData | string;
  alt: string;
  place: string;
  credit: string;
};

export const SCENES = {
  guesthouse: {
    src: "/images/guesthouse-cliff.jpg",
    alt: "A stone and timber guesthouse on a cliff in Hunza, with snow peaks behind",
    place: "Altit, Hunza",
    credit: "Wajeeha Khan / Unsplash",
  },
  blossom: {
    src: "/images/apricot-blossom.jpg",
    alt: "Apricot blossom in spring above a dry-stone wall in Gilgit-Baltistan",
    place: "Gilgit-Baltistan",
    credit: "Maida Liaqat / Unsplash",
  },
  valley: {
    src: "/images/hunza-valley.jpg",
    alt: "A village of flat-roofed houses in the Hunza valley under snow-covered mountains",
    place: "Hunza valley",
    credit: "Hasan Shaukat / Unsplash",
  },
} satisfies Record<string, Scene>;

// Shared editorial layout for account access and confirmation screens.
export function AuthShell({
  title,
  lede,
  scene = SCENES.guesthouse,
  aside,
  children,
  footer,
}: {
  title: string;
  lede?: React.ReactNode;
  scene?: Scene;
  aside?: { stamp: string; line: string };
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="auth-layout">
      <main className="auth-main">
        <Link href="/" className="inline-flex min-h-11 w-fit items-center rounded-md" aria-label={`${PRODUCT_NAME} home`}>
          <Wordmark />
        </Link>
        <div className="auth-form-wrap">
          <div className="auth-form animate-rise">
            <h1 className="auth-title">{title}</h1>
            {lede && <p className="mt-4 text-[15px] leading-7 text-muted">{lede}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-7 border-t border-hairline pt-6 text-sm text-muted">{footer}</div>}
          </div>
        </div>
        <p className="text-xs leading-5 text-muted">Software for hosts. {PRODUCT_NAME} never holds guest money.</p>
      </main>
      <aside className="auth-aside">
        <div className="auth-story">
          <p className="eyebrow">{aside?.stamp ?? "Made for thoughtful hosts"}</p>
          <p className="auth-story-title">{aside?.line ?? "A more personal way to welcome your guests."}</p>
        </div>
        <div className="auth-photo">
          <Image src={scene.src} alt={scene.alt} fill preload sizes="(min-width: 768px) 50vw, 0px" className="object-cover" />
        </div>
      </aside>
    </div>
  );
}
// The centred confirmation panel used by "check your email" style screens.
export function AuthMessage({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-5">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</span>
      <div className="flex flex-col gap-2">
        <p className="text-lg font-medium text-ink">{title}</p>
        <div className="text-[15px] leading-6 text-muted">{children}</div>
      </div>
    </div>
  );
}
