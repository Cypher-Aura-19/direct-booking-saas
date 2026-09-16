const HIGHLIGHTS = ["Direct bookings", "Live availability", "Guest chat"];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-pine px-12 py-14 text-mist lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 20% 15%, rgba(47,141,136,0.35), transparent), radial-gradient(45% 40% at 85% 90%, rgba(217,140,63,0.18), transparent)",
          }}
          aria-hidden
        />
        <span className="relative text-sm font-semibold uppercase tracking-[0.2em] text-mist/70">
          Host Dashboard
        </span>
        <div className="relative space-y-6">
          <h1 className="max-w-md font-display text-4xl font-medium italic leading-[1.15] text-mist">
            Your own booking desk, open before the first guest ever lands on your page.
          </h1>
          <ul className="flex flex-wrap gap-2 text-sm">
            {HIGHLIGHTS.map((item) => (
              <li
                key={item}
                className="rounded-full border border-mist/20 px-3 py-1 text-mist/80"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-mist/60">
          Built for guesthouses and cabins that already have guests — Murree to Skardu.
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
