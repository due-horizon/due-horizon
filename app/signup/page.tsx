"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Plan = "starter" | "growth" | "scale" | "core" | "operations" | "enterprise" | null;
type AccountType = "firm" | "business" | null;

const validPlans = new Set(["starter", "growth", "scale", "core", "operations", "enterprise"]);
const validTypes = new Set(["firm", "business"]);

function normalizePlan(value: string | null): Plan {
  if (!value) return null;
  return validPlans.has(value) ? (value as Plan) : null;
}

function normalizeType(value: string | null): AccountType {
  if (!value) return null;
  return validTypes.has(value) ? (value as AccountType) : null;
}

function inferTypeFromPlan(plan: Plan): AccountType {
  if (plan === "starter" || plan === "growth" || plan === "scale") return "firm";
  if (plan === "core" || plan === "operations" || plan === "enterprise") return "business";
  return null;
}

function getPlanLabel(plan: Plan) {
  if (plan === "starter") return "Starter";
  if (plan === "growth") return "Growth";
  if (plan === "scale") return "Scale";
  if (plan === "core") return "Core";
  if (plan === "operations") return "Operations";
  if (plan === "enterprise") return "Enterprise";
  return "Not selected";
}

function getTypeLabel(type: AccountType) {
  if (type === "firm") return "Accounting firm";
  if (type === "business") return "Business";
  return "Not selected";
}

function getWorkspaceFieldLabel(type: AccountType) {
  if (type === "firm") return "Firm name";
  if (type === "business") return "Business name";
  return "Workspace name";
}

function getWorkspacePlaceholder(type: AccountType) {
  if (type === "firm") return "Carr Accounting Solutions";
  if (type === "business") return "Hudson Valley Plumbing";
  return "Enter workspace name";
}

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();

  const [selectedPlan, setSelectedPlan] = useState<Plan>(null);
  const [initialType, setInitialType] = useState<AccountType>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loginHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("next", "/onboarding");
    if (selectedPlan) params.set("plan", selectedPlan);
    if (initialType) params.set("type", initialType);
    if (workspaceName.trim()) params.set("workspace", workspaceName.trim());
    if (inviteToken) params.set("invite", inviteToken);
    return `/login?${params.toString()}`;
  }, [selectedPlan, initialType, workspaceName, inviteToken]);

  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const plan = normalizePlan(params.get("plan"));
    const inferredType = normalizeType(params.get("type")) || inferTypeFromPlan(plan);
    const invite = params.get("invite");
    const workspace = params.get("workspace")?.trim() || "";

    setSelectedPlan(plan);
    setInitialType(inferredType);
    setInviteToken(invite);
    if (workspace) setWorkspaceName(workspace);
  }, []);

  useEffect(() => {
    setAccountType(initialType);
  }, [initialType]);

  const [paramsLoaded, setParamsLoaded] = useState(false);

useEffect(() => {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const plan = normalizePlan(params.get("plan"));
  const inferredType =
    normalizeType(params.get("type")) || inferTypeFromPlan(plan);
  const invite = params.get("invite");
  const workspace = params.get("workspace")?.trim() || "";

  setSelectedPlan(plan);
  setInitialType(inferredType);
  setInviteToken(invite);
  if (workspace) setWorkspaceName(workspace);

  setParamsLoaded(true); // 👈 THIS IS THE KEY
}, []);

useEffect(() => {
  if (!paramsLoaded) return; // 👈 WAIT

  if (!selectedPlan && !inviteToken) {
    router.replace("/home#pricing");
  }
}, [paramsLoaded, selectedPlan, inviteToken, router]);

  const requiresWorkspaceName = !inviteToken;
  const canSubmit =
    (!!selectedPlan || !!inviteToken) &&
    email.trim().length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    !!accountType &&
    (!requiresWorkspaceName || workspaceName.trim().length > 0);

  const buildCallbackUrl = () => {
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", "/onboarding");

    if (selectedPlan) callback.searchParams.set("plan", selectedPlan);
    if (accountType) callback.searchParams.set("type", accountType);
    if (workspaceName.trim()) callback.searchParams.set("workspace", workspaceName.trim());
    if (inviteToken) callback.searchParams.set("invite", inviteToken);

    return callback.toString();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!selectedPlan && !inviteToken) {
      setError("Choose a plan from pricing before creating your account.");
      return;
    }

    if (!accountType) {
      setError("We could not determine whether this workspace is for a firm or a business.");
      return;
    }

    if (requiresWorkspaceName && !workspaceName.trim()) {
      setError(
        `Enter your ${
          accountType === "firm" ? "firm" : accountType === "business" ? "business" : "workspace"
        } name.`
      );
      return;
    }

    setLoading(true);

    const redirectTo = buildCallbackUrl();
    const emailToUse = email.trim();

    const { error } = await supabase.auth.signUp({
      email: emailToUse,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          pending_plan: selectedPlan,
          pending_account_type: accountType,
          pending_workspace_name: workspaceName.trim() || null,
          pending_invite_token: inviteToken,
        },
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSubmittedEmail(emailToUse);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setAccountCreated(true);
    setSuccess(
      inviteToken
        ? "Account created. Check your email to confirm your account and accept the invite."
        : "Account created. Check your email to confirm your account and continue setup."
    );
  };

  const handleGoogleSignup = async () => {
    setError(null);
    setSuccess(null);

    if (!accountType) {
      setError("We could not determine whether this workspace is for a firm or a business.");
      return;
    }

    if (requiresWorkspaceName && !workspaceName.trim()) {
      setError(
        `Enter your ${
          accountType === "firm" ? "firm" : accountType === "business" ? "business" : "workspace"
        } name.`
      );
      return;
    }

    setLoadingGoogle(true);

    const redirectTo = buildCallbackUrl();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      setError(error.message);
      setLoadingGoogle(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1220] px-6 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_42%),radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.08),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:56px_56px]" />

      <div className="relative grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="space-y-5">
            <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-300">
              Built for firms and businesses
            </div>

            <h1 className="max-w-xl text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-white sm:text-5xl">
              {accountType === "business"
                ? "Create your business workspace and get compliance under control."
                : accountType === "firm"
                  ? "Create your firm workspace and get compliance under control."
                  : "Create your workspace and get compliance under control."}
            </h1>

            <p className="max-w-lg text-lg leading-8 text-slate-400">
              Start your account, keep your selected plan attached, and move cleanly into onboarding.
            </p>
          </div>

          <div className="grid max-w-xl gap-3">
            <FeaturePill text="Preserves selected plan through signup" />
            <FeaturePill text="Supports Google and email signup" />
            <FeaturePill
              text={
                accountType === "business"
                  ? "Built for business workspaces"
                  : accountType === "firm"
                    ? "Built for firm workspaces"
                    : "Built for firm or business workspaces"
              }
            />
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                {inviteToken ? "Accept invite" : "Create account"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {inviteToken
                  ? "Create your account to join the invited workspace."
                  : "Start your setup and carry your plan, type, and workspace context into onboarding."}
              </p>
            </div>

            {!selectedPlan && !inviteToken && (
              <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Choose a plan from the pricing section before creating your account. Redirecting you now.
              </div>
            )}

            {(selectedPlan || accountType || inviteToken) && (
              <div className="mb-5 grid gap-3 rounded-2xl border border-white/10 bg-[#020617]/70 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Plan</span>
                  <span className="font-medium text-white">{getPlanLabel(selectedPlan)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Workspace type</span>
                  <span className="font-medium text-white">{getTypeLabel(accountType)}</span>
                </div>
                {inviteToken && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Invite</span>
                    <span className="font-medium text-emerald-300">Attached</span>
                  </div>
                )}
              </div>
            )}

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

            {accountCreated ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-[#020617]/70 p-4 text-sm text-slate-300">
                  <div className="font-medium text-white">Check your email</div>
                  <div className="mt-2 leading-6">
                    We sent a confirmation link to{" "}
                    <span className="font-medium text-cyan-300">
                      {submittedEmail || "your email address"}
                    </span>
                    . After you confirm, you will continue into onboarding.
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                  If no email arrives, the issue is usually in Supabase Auth settings or SMTP/email template configuration.
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountCreated(false);
                      setSuccess(null);
                      setSubmittedEmail(null);
                    }}
                    className="h-12 cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                  >
                    Use a different email
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push(loginHref)}
                    className="h-12 cursor-pointer rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.3)] transition duration-200 hover:scale-[1.01] hover:shadow-[0_18px_40px_rgba(37,99,235,0.38)]"
                  >
                    Go to login
                  </button>
                </div>
              </div>
            ) : (
              <>
                {!initialType && !inviteToken && (
                  <div className="mb-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAccountType("firm")}
                      className={`cursor-pointer rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                        accountType === "firm"
                          ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                          : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                      }`}
                    >
                      Accounting firm
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType("business")}
                      className={`cursor-pointer rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                        accountType === "business"
                          ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                          : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                      }`}
                    >
                      Business
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleGoogleSignup}
                  disabled={loadingGoogle}
                  className="group mb-4 flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] text-[15px] font-medium text-white transition duration-200 hover:border-white/15 hover:bg-white/[0.08] active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <GoogleIcon />
                  <span>
                    {loadingGoogle
                      ? "Connecting..."
                      : inviteToken
                        ? "Continue with Google to accept invite"
                        : "Continue with Google"}
                  </span>
                </button>

                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Or</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <FieldLabel>{getWorkspaceFieldLabel(accountType)}</FieldLabel>
                    <input
                      type="text"
                      required={requiresWorkspaceName}
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-[#020617]/90 px-4 text-white outline-none transition duration-200 placeholder:text-slate-500 focus:border-cyan-400/60 focus:bg-[#06101f] focus:shadow-[0_0_0_4px_rgba(34,211,238,0.08)]"
                      placeholder={getWorkspacePlaceholder(accountType)}
                      autoComplete="organization"
                    />
                  </div>

                  <div>
                    <FieldLabel>Email</FieldLabel>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-[#020617]/90 px-4 text-white outline-none transition duration-200 placeholder:text-slate-500 focus:border-cyan-400/60 focus:bg-[#06101f] focus:shadow-[0_0_0_4px_rgba(34,211,238,0.08)]"
                      placeholder={accountType === "business" ? "you@company.com" : "you@firm.com"}
                      autoComplete="email"
                    />
                  </div>

                  <PasswordField
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    shown={showPassword}
                    onToggle={() => setShowPassword((current) => !current)}
                    placeholder="Create a password"
                    autoComplete="new-password"
                  />

                  <PasswordField
                    label="Confirm password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    shown={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((current) => !current)}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                  />

                  <button
                    type="submit"
                    disabled={loading || !canSubmit}
                    className="mt-2 h-12 w-full cursor-pointer rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.3)] transition duration-200 hover:scale-[1.01] hover:shadow-[0_18px_40px_rgba(37,99,235,0.38)] active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading
                      ? "Creating account..."
                      : inviteToken
                        ? "Create account and continue"
                        : "Create account"}
                  </button>
                </form>
              </>
            )}

            <div className="mt-6 text-center text-sm text-slate-400">
              Already have an account?{" "}
              <Link href={loginHref} className="font-medium text-cyan-300 transition hover:text-cyan-200">
                Sign in
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
  return <label className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-slate-400">{children}</label>;
}

function FeaturePill({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-200">
      <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.7)]" />
      <span>{text}</span>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  shown,
  onToggle,
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  shown: boolean;
  onToggle: () => void;
  placeholder: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-2 flex items-center rounded-2xl border border-white/10 bg-[#020617]/90 px-4 transition duration-200 focus-within:border-cyan-400/60 focus-within:bg-[#06101f] focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.08)]">
        <input
          type={shown ? "text" : "password"}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full bg-transparent text-white outline-none placeholder:text-slate-500"
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={onToggle}
          className="text-sm font-medium text-slate-400 transition hover:text-slate-200"
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
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