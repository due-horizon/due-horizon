import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PATHS = ["/dashboard", "/filings", "/calendar", "/reports", "/onboarding"];
const AUTH_PATHS = ["/login", "/signup"];
const ONBOARDING_PATH = "/onboarding";
const DASHBOARD_PATH = "/dashboard";
const BILLING_PATH = "/settings/billing";

function startsWithPath(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = startsWithPath(pathname, PROTECTED_PATHS);
  const isAuthPage = startsWithPath(pathname, AUTH_PATHS);
  const isOnboardingPage = startsWithPath(pathname, [ONBOARDING_PATH]);
  const isDashboardArea = startsWithPath(pathname, ["/dashboard", "/filings", "/calendar", "/reports"]);

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!user) {
    return response;
  }

  const preferredFirmId =
    typeof user.user_metadata?.firm_id === "string"
      ? user.user_metadata.firm_id
      : typeof user.user_metadata?.workspace_id === "string"
        ? user.user_metadata.workspace_id
        : null;

  const { data: memberships, error: membershipError } = await supabase
    .from("firm_members")
    .select("firm_id, role")
    .eq("user_id", user.id);

  if (membershipError) {
    console.error("middleware membership lookup failed", membershipError);
  }

  const resolvedFirmId =
    memberships?.find((m) => m.firm_id === preferredFirmId)?.firm_id ??
    memberships?.[0]?.firm_id ??
    preferredFirmId ??
    null;

  let firm:
    | {
        id: string;
        onboarding_completed: boolean | null;
        subscription_status: string | null;
        trial_ends_at: string | null;
        type: string | null;
        plan: string | null;
      }
    | null = null;

  if (resolvedFirmId) {
    const { data: firmData, error: firmError } = await supabase
      .from("firms")
      .select("id, onboarding_completed, subscription_status, trial_ends_at, type, plan")
      .eq("id", resolvedFirmId)
      .maybeSingle();

    if (firmError) {
      console.error("middleware firm lookup failed", firmError);
    } else {
      firm = firmData;
    }
  }

  const onboardingCompleted = !!firm?.onboarding_completed || !!user.user_metadata?.onboarded;

  const subscriptionStatus = firm?.subscription_status ?? "trial";
  const trialEndsAt = firm?.trial_ends_at ? new Date(firm.trial_ends_at) : null;
  const now = new Date();

  const trialExpired =
    subscriptionStatus === "trial" &&
    !!trialEndsAt &&
    !Number.isNaN(trialEndsAt.getTime()) &&
    trialEndsAt.getTime() < now.getTime();

  const billingLocked =
    subscriptionStatus === "expired" ||
    subscriptionStatus === "past_due" ||
    subscriptionStatus === "canceled" ||
    trialExpired;

  if (!resolvedFirmId && isDashboardArea) {
    const url = request.nextUrl.clone();
    url.pathname = ONBOARDING_PATH;
    return NextResponse.redirect(url);
  }

  if (resolvedFirmId && !onboardingCompleted && isDashboardArea) {
    const url = request.nextUrl.clone();
    url.pathname = ONBOARDING_PATH;
    return NextResponse.redirect(url);
  }

  if (resolvedFirmId && onboardingCompleted && isOnboardingPage) {
    const url = request.nextUrl.clone();
    url.pathname = DASHBOARD_PATH;
    return NextResponse.redirect(url);
  }

  if (resolvedFirmId && billingLocked && isDashboardArea) {
    const url = request.nextUrl.clone();
    url.pathname = BILLING_PATH;
    url.searchParams.set("reason", trialExpired ? "trial_expired" : "subscription_locked");
    return NextResponse.redirect(url);
  }

   if (isAuthPage) {
    const requestedNext = request.nextUrl.searchParams.get("next");
    const safeNext =
      requestedNext &&
      requestedNext.startsWith("/") &&
      !requestedNext.startsWith("//") &&
      requestedNext !== "/" &&
      requestedNext !== "/login" &&
      requestedNext !== "/signup"
        ? requestedNext
        : null;

    if (safeNext) {
      const url = request.nextUrl.clone();
      url.pathname = safeNext;
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (onboardingCompleted) {
      const url = request.nextUrl.clone();
      url.pathname = DASHBOARD_PATH;
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (resolvedFirmId && !onboardingCompleted) {
      const url = request.nextUrl.clone();
      url.pathname = ONBOARDING_PATH;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/filings/:path*",
    "/calendar/:path*",
    "/reports/:path*",
    "/onboarding/:path*",
    "/login",
    "/signup",
  ],
};