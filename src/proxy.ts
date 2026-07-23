import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { SITE_GATE_COOKIE, SITE_GATE_PATH, hashSitePassword } from "@/lib/site-gate";

const roleHomePath: Record<string, string> = {
  care_provider: "/provider/dashboard",
  supplier: "/supplier/dashboard",
  platform_admin: "/admin/dashboard",
};

const roleSectionPrefix: Record<string, string> = {
  care_provider: "/provider",
  supplier: "/supplier",
  platform_admin: "/admin",
};

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/provider") ||
    pathname.startsWith("/supplier") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/account")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Whole-site password gate for trusted testers - independent of, and
  // ahead of, the app's real authentication below. Only active when
  // SITE_PASSWORD is set, so local dev and any deploy that hasn't
  // configured it behave exactly as before (fully open).
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword && pathname !== "/api/health") {
    const expectedToken = await hashSitePassword(sitePassword);
    const hasAccess = request.cookies.get(SITE_GATE_COOKIE)?.value === expectedToken;

    if (pathname === SITE_GATE_PATH) {
      if (hasAccess) {
        const next = request.nextUrl.searchParams.get("next") || "/";
        return NextResponse.redirect(new URL(next, request.url));
      }
      return NextResponse.next({ request });
    }

    if (!hasAccess) {
      const gateUrl = new URL(SITE_GATE_PATH, request.url);
      gateUrl.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(gateUrl);
    }
  }

  const response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isProtectedPath(pathname)) {
    return response;
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: membership } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let orgType: string | undefined;
  if (membership?.organisation_id) {
    const { data: organisation } = await supabase
      .from("organisations")
      .select("type")
      .eq("id", membership.organisation_id)
      .maybeSingle();
    orgType = organisation?.type;
  }

  if (!orgType) {
    if (pathname.startsWith("/onboarding")) {
      return response;
    }
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  if (pathname.startsWith("/onboarding")) {
    return NextResponse.redirect(new URL(roleHomePath[orgType] ?? "/", request.url));
  }

  const expectedPrefix = roleSectionPrefix[orgType];
  const inOwnSection = expectedPrefix && pathname.startsWith(expectedPrefix);
  const inAccountSection = pathname.startsWith("/account");

  if (!inOwnSection && !inAccountSection) {
    return NextResponse.redirect(new URL(roleHomePath[orgType] ?? "/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
