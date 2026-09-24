import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Only these need a session. Everything else — the marketing page, the auth
// pages, and (from M5) the public guest pages — must stay reachable signed out.
export function isProtectedPath(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname === "/onboarding";
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
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
