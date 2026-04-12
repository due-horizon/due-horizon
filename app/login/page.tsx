"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [nextParam, setNextParam] = useState<string | null>(null);
  const [planParam, setPlanParam] = useState<string | null>(null);
  const [typeParam, setTypeParam] = useState<string | null>(null);
  const [workspaceParam, setWorkspaceParam] = useState<string | null>(null);
  const [inviteParam, setInviteParam] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    setNextParam(params.get("next"));
    setPlanParam(params.get("plan"));
    setTypeParam(params.get("type"));
    setWorkspaceParam(params.get("workspace"));
    setInviteParam(params.get("invite"));
  }, []);

  const signUpHref = useMemo(() => {
    const signUpParams = new URLSearchParams();
    if (nextParam) signUpParams.set("next", nextParam);
    if (planParam) signUpParams.set("plan", planParam);
    if (typeParam) signUpParams.set("type", typeParam);
    if (workspaceParam) signUpParams.set("workspace", workspaceParam);
    if (inviteParam) signUpParams.set("invite", inviteParam);

    return signUpParams.toString()
      ? `/signup?${signUpParams.toString()}`
      : "/signup";
  }, [nextParam, planParam, typeParam, workspaceParam, inviteParam]);

  const selectedPlanLabel = useMemo(() => {
    if (!planParam) return null;

    const normalized = planParam.trim().toLowerCase();

    const map: Record<string, string> = {
      starter: "Starter",
      growth: "Growth",
      scale: "Scale",
      core: "Core",
      operations: "Operations",
      enterprise: "Enterprise",
    };

    return map[normalized] || planParam;
  }, [planParam]);

  const selectedTypeLabel = useMemo(() => {
    if (!typeParam) return null;

    const normalized = typeParam.trim().toLowerCase();

    if (normalized === "firm" || normalized === "accounting_firm") return "Firm";
    if (normalized === "business" || normalized === "business_owner") return "Business";

    return typeParam;
  }, [typeParam]);

  const selectedContextLabel = useMemo(() => {
    if (selectedPlanLabel && selectedTypeLabel) {
      return `${selectedTypeLabel} ${selectedPlanLabel}`;
    }

    return selectedPlanLabel || selectedTypeLabel || null;
  }, [selectedPlanLabel, selectedTypeLabel]);

  const oauthRedirectUrl = useMemo(() => {
    if (typeof window === "undefined") return "";

    const callbackUrl = new URL("/auth/callback", window.location.origin);

    const normalizedNext =
      nextParam &&
      nextParam.startsWith("/") &&
      nextParam !== "/" &&
      nextParam !== "/login" &&
      nextParam !== "/signup"
        ? nextParam
        : "/onboarding";

    callbackUrl.searchParams.set("next", normalizedNext);

    if (planParam) callbackUrl.searchParams.set("plan", planParam);
    if (typeParam) callbackUrl.searchParams.set("type", typeParam);
    if (workspaceParam) callbackUrl.searchParams.set("workspace", workspaceParam);
    if (inviteParam) callbackUrl.searchParams.set("invite", inviteParam);

    return callbackUrl.toString();
  }, [nextParam, planParam, typeParam, workspaceParam, inviteParam]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getPostLoginPath = async (userId: string, preferredFirmId?: string | null) => {
    try {
      const { data: memberships, error: membershipError } = await supabase
        .from("firm_members")
        .select("firm_id")
        .eq("user_id", userId);

      if (membershipError) {
        console.error("Failed to check firm memberships:", membershipError);
        return "/onboarding";
      }

      const membershipIds = (memberships || []).map((membership) => membership.firm_id);
      const resolvedFirmId =
        (preferredFirmId && membershipIds.includes(preferredFirmId) ? preferredFirmId : null) ||
        membershipIds[0] ||
        preferredFirmId ||
        null;

      if (!resolvedFirmId) {
        return "/onboarding";
      }

      const { data: firm, error: firmError } = await supabase
        .from("firms")
        .select("onboarding_completed")
        .eq("id", resolvedFirmId)
        .maybeSingle();

      if (firmError) {
        console.error("Failed to check firm onboarding status:", firmError);
        return "/onboarding";
      }

      return firm?.onboarding_completed ? "/dashboard" : "/onboarding";
    } catch (err) {
      console.error("Unexpected post-login routing error:", err);
      return "/onboarding";
    }
  };

  const buildDestinationUrl = async (userId: string, preferredFirmId?: string | null) => {
    const computedPath = await getPostLoginPath(userId, preferredFirmId);

    const normalizedNext =
      nextParam &&
      nextParam.startsWith("/") &&
      nextParam !== "/" &&
      nextParam !== "/login" &&
      nextParam !== "/signup"
        ? nextParam
        : null;

    const basePath = normalizedNext || computedPath;
    const shouldPreserveContext = basePath === "/onboarding";

    if (!shouldPreserveContext) {
      return basePath;
    }

    const params = new URLSearchParams();
    if (planParam) params.set("plan", planParam);
    if (typeParam) params.set("type", typeParam);
    if (workspaceParam) params.set("workspace", workspaceParam);
    if (inviteParam) params.set("invite", inviteParam);

    return params.toString() ? `${basePath}?${params.toString()}` : basePath;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    const userId = data.user?.id;

    if (!userId) {
      setLoading(false);
      setError("Login succeeded, but no user was returned.");
      return;
    }

    const preferredFirmId =
      typeof data.user?.user_metadata?.firm_id === "string"
        ? data.user.user_metadata.firm_id
        : typeof data.user?.user_metadata?.workspace_id === "string"
          ? data.user.user_metadata.workspace_id
          : null;

    const destination = await buildDestinationUrl(userId, preferredFirmId);

    setLoading(false);
    router.replace(destination);
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setSuccess(null);
    setLoadingGoogle(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: oauthRedirectUrl,
      },
    });

    if (error) {
      setError(error.message);
      setLoadingGoogle(false);
    }
  };

  const handleResetPassword = async () => {
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError("Enter your email above first, then click Forgot Password?");
      return;
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/update-password`,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess("Password reset link sent. Check your email.");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1220] px-6 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_42%),radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.08),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:56px_56px]" />

      <div className="relative grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-300">
                Built for firms and businesses
              </div>

              {selectedContextLabel && (
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-200">
                  Continuing with {selectedContextLabel}
                </div>
              )}
            </div>

            <h1 className="max-w-xl text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-white sm:text-5xl">
              {selectedContextLabel
                ? `Sign in to continue with ${selectedContextLabel}.`
                : "Welcome back to the command center for your compliance work."}
            </h1>

            <p className="max-w-lg text-lg leading-8 text-slate-400">
              Sign in to manage recurring filings, monitor upcoming deadlines, and stay ahead of every deadline across your workspace.
            </p>
          </div>

          <div className="grid max-w-xl gap-3">
            <FeaturePill text="Track filings across clients, entities, and teams" />
            <FeaturePill text="Automate recurring compliance workflows" />
            <FeaturePill text="Stay ahead without the chaos" />
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight text-white">Sign in</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {selectedContextLabel
                  ? `Access your account to continue with ${selectedContextLabel} and pick up where you left off.`
                  : "Access your dashboard and pick up where you left off."}
              </p>

              {selectedContextLabel && (
                <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/8 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/85">
                    Saved selection
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {selectedContextLabel}
                  </div>
                  <div className="mt-1 text-xs leading-6 text-slate-300">
                    We’ll carry this selection through sign in so you can continue onboarding without losing context.
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {success}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loadingGoogle}
              className="group mb-4 flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] text-[15px] font-medium text-white transition duration-200 hover:border-white/15 hover:bg-white/[0.08] active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <GoogleIcon />
              <span>{loadingGoogle ? "Connecting..." : "Continue with Google"}</span>
            </button>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <FieldLabel>Email</FieldLabel>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[#020617]/90 px-4 text-white outline-none transition duration-200 placeholder:text-slate-500 focus:border-cyan-400/60 focus:bg-[#06101f] focus:shadow-[0_0_0_4px_rgba(34,211,238,0.08)]"
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <FieldLabel>Password</FieldLabel>
                </div>

                <div className="flex items-center rounded-2xl border border-white/10 bg-[#020617]/90 px-4 transition duration-200 focus-within:border-cyan-400/60 focus-within:bg-[#06101f] focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.08)]">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="cursor-pointer text-sm font-medium text-slate-400 transition hover:text-slate-200"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 h-12 w-full cursor-pointer rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.3)] transition duration-200 hover:scale-[1.01] hover:shadow-[0_18px_40px_rgba(37,99,235,0.38)] active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="cursor-pointer text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-300"
                >
                  Forgot password?
                </button>
              </div>
            </form>

            <div className="mt-6 text-center text-sm text-slate-400">
              New here?{" "}
              <Link href={signUpHref} className="font-medium text-cyan-300 transition hover:text-cyan-200">
                Start free trial
              </Link>
            </div>

            <div className="mt-4 text-center">
              <Link
                href="/home"
                className="group inline-flex items-center justify-center gap-1 text-sm font-medium text-slate-400 transition hover:text-white"
              >
                <span className="transition group-hover:-translate-x-0.5">←</span>
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        textarea:-webkit-autofill,
        select:-webkit-autofill {
          -webkit-text-fill-color: #ffffff !important;
          -webkit-box-shadow: 0 0 0px 1000px #020617 inset !important;
          box-shadow: 0 0 0px 1000px #020617 inset !important;
          transition: background-color 9999s ease-in-out 0s;
          caret-color: #ffffff;
          border-radius: 1rem;
        }
      `}</style>
    </main>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-400">{children}</label>;
}

function FeaturePill({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 backdrop-blur-sm transition duration-200 hover:-translate-y-[1px] hover:bg-white/[0.05]">
      <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" />
      <span>{text}</span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.8 2.8 14.6 2 12 2 6.9 2 2.8 6.3 2.8 11.6S6.9 21.2 12 21.2c6.4 0 8.8-4.5 8.8-6.8 0-.5-.1-.9-.1-1.3H12Z"
      />
      <path
        fill="#34A853"
        d="M2.8 11.6c0 1.7.6 3.3 1.7 4.5l3-2.3c-.4-.6-.6-1.4-.6-2.2s.2-1.5.6-2.2l-3-2.3c-1.1 1.2-1.7 2.8-1.7 4.5Z"
      />
      <path
        fill="#FBBC05"
        d="M12 21.2c2.4 0 4.5-.8 6-2.3l-2.9-2.4c-.8.6-1.9 1-3.1 1-2.5 0-4.7-1.7-5.4-4l-3 2.3c1.5 3.1 4.6 5.4 8.4 5.4Z"
      />
      <path
        fill="#4285F4"
        d="M18 18.9c1.7-1.5 2.8-3.8 2.8-6.5 0-.5-.1-.9-.1-1.3H12v3.9h5.5c-.3 1.3-1.1 2.8-2.6 3.9l3.1 2.4Z"
      />
    </svg>
  );
}