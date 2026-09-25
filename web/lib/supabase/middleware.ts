import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Only these need a session. Everything else — the marketing page, the auth
// pages, and (from M5) the public guest pages — must stay reachable signed out.
export function isProtectedPath(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname === "/onboarding";
}

// Guest pages: no session is read or refreshed, keeping the first byte fast
// on mobile data (PERF-01), and a guest never needs to log in (PUB-04).
export function isPublicPath(pathname: string): boolean {
  return pathname === "/s" || pathname.startsWith("/s/");
}

// D-14: the stay. subdomain serves /s/* at its root, so the link a host puts
// in their Instagram bio is short (stay.qayam.pk/altit). A host slug like
// "login" can't break the app, because on this host every path is a
// catalogue path. Paths already under /s/ are left as they are, so in-page
// links (rendered as /s/...) work on both hosts.
export function stayRewritePath(host: string | null, pathname: string, stayHost: string | undefined): string | null {
  if (!host || !stayHost) return null;
  if (host.split(":")[0].toLowerCase() !== stayHost.toLowerCase()) return null;
  if (isPublicPath(pathname)) return null;
  return pathname === "/" ? "/s" : `/s${pathname}`;
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const rewrite = stayRewritePath(
    request.headers.get("host") ?? request.nextUrl.host,
    request.nextUrl.pathname,
    process.env.STAY_HOST,
  );
  if (rewrite) {
    const url = request.nextUrl.clone();
    url.pathname = rewrite;
    return NextResponse.rewrite(url);
  }
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // The actual refresh: this call is what re-issues an expiring access
  // token using the refresh token, and writes the new pair back via
  // setAll above if the token had to be rotated.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // dashboard/layout.tsx guards too, but a layout does not re-run on
  // client-side navigation between its child routes. This runs on every
  // request, including the RSC fetches that client navigation makes.
  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    const redirectResponse = NextResponse.redirect(loginUrl);
    // Carry over any cookie changes (e.g. a cleared dead session).
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  return response;
}
