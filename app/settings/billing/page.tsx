"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Panel, SettingsShell } from "../_shared";

type BillingState = {
  plan: string;
  subscriptionStatus: string;
  billingContact: string;
  stripeCustomerId: string | null;
  trialEndsAt: string | null;
  workspaceName: string;
  workspaceType: string;
};

function formatPlan(plan: string | null | undefined) {
  if (!plan) return "Not set";
  const normalized = plan.toLowerCase();

  const map: Record<string, string> = {
    starter: "Starter",
    growth: "Growth",
    scale: "Scale",
    core: "Core",
    operations: "Operations",
    enterprise: "Enterprise",
  };

  return map[normalized] || plan;
}

function formatStatus(status: string | null | undefined) {
  if (!status) return "Unknown";

  const normalized = status.toLowerCase();

  if (normalized === "trial" || normalized === "trialing") return "Trial";
  if (normalized === "active") return "Active";
  if (normalized === "past_due") return "Past due";
  if (normalized === "canceled") return "Canceled";
  if (normalized === "expired") return "Expired";

  return status.replace(/_/g, " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getDaysRemaining(value: string | null | undefined) {
  if (!value) return null;

  const end = new Date(value);
  if (Number.isNaN(end.getTime())) return null;

  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function BillingSettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [billing, setBilling] = useState<BillingState>({
    plan: "",
    subscriptionStatus: "",
    billingContact: "",
    stripeCustomerId: null,
    trialEndsAt: null,
    workspaceName: "",
    workspaceType: "",
  });

  useEffect(() => {
    async function loadBilling() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Unable to load billing details.");
        setLoading(false);
        return;
      }

      const preferredFirmId =
        typeof user.user_metadata?.firm_id === "string"
          ? user.user_metadata.firm_id
          : typeof user.user_metadata?.workspace_id === "string"
            ? user.user_metadata.workspace_id
            : null;

      const { data: memberships, error: membershipError } = await supabase
        .from("firm_members")
        .select("firm_id")
        .eq("user_id", user.id);

      if (membershipError) {
        setError("Unable to load billing details.");
        setLoading(false);
        return;
      }

      const membershipIds = (memberships || []).map((membership) => membership.firm_id);
      const resolvedFirmId =
        (preferredFirmId && membershipIds.includes(preferredFirmId) ? preferredFirmId : null) ||
        membershipIds[0] ||
        preferredFirmId ||
        null;

      if (!resolvedFirmId) {
        setError("No workspace was found for this account.");
        setLoading(false);
        return;
      }

      const { data: firm, error: firmError } = await supabase
        .from("firms")
        .select("id, name, type, plan, subscription_status, stripe_customer_id, trial_ends_at")
        .eq("id", resolvedFirmId)
        .maybeSingle();

      if (firmError || !firm) {
        setError("Unable to load workspace billing details.");
        setLoading(false);
        return;
      }

      setBilling({
        plan: typeof firm.plan === "string" ? firm.plan : "",
        subscriptionStatus:
          typeof firm.subscription_status === "string" ? firm.subscription_status : "",
        billingContact: user.email || "",
        stripeCustomerId:
          typeof firm.stripe_customer_id === "string" ? firm.stripe_customer_id : null,
        trialEndsAt: typeof firm.trial_ends_at === "string" ? firm.trial_ends_at : null,
        workspaceName: typeof firm.name === "string" ? firm.name : "",
        workspaceType: typeof firm.type === "string" ? firm.type : "",
      });

      setLoading(false);
    }

    loadBilling();
  }, [supabase]);

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  const formattedPlan = formatPlan(billing.plan);
  const formattedStatus = formatStatus(billing.subscriptionStatus);
  const formattedTrialEnd = formatDate(billing.trialEndsAt);
  const daysRemaining = getDaysRemaining(billing.trialEndsAt);

  const isTrial =
    billing.subscriptionStatus === "trial" || billing.subscriptionStatus === "trialing";
  const isActive = billing.subscriptionStatus === "active";

  async function handleManageBilling() {
    try {
      setActionLoading(true);
      setError(null);

      if (billing.stripeCustomerId) {
        const response = await fetch("/api/stripe/portal", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerId: billing.stripeCustomerId,
            returnUrl: `${window.location.origin}/settings/billing`,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.url) {
          throw new Error(data.error || "Unable to open billing portal.");
        }

        window.location.href = data.url;
        return;
      }

      window.location.href = "/home#pricing";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open billing.");
      setActionLoading(false);
    }
  }

  return (
    <SettingsShell
      title="Billing settings"
      description="Manage your subscription, trial status, payment details, and billing records from one place."
    >
      <div className="space-y-6">
        {success && (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-300">
            Billing was updated successfully.
          </div>
        )}

        {canceled && (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-200">
            Checkout was canceled. Your plan has not changed.
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <Panel
          title="Plan details"
          description="See your current plan, subscription status, and trial timing."
        >
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
              Loading billing details...
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DetailCard
                  label="Workspace"
                  value={billing.workspaceName || "—"}
                  helper={
                    billing.workspaceType === "business"
                      ? "Business workspace"
                      : billing.workspaceType === "firm"
                        ? "Accounting firm workspace"
                        : "Workspace"
                  }
                />
                <DetailCard
                  label="Current plan"
                  value={formattedPlan}
                  helper="Selected from pricing"
                />
                <DetailCard
                  label="Status"
                  value={formattedStatus}
                  helper={
                    isTrial
                      ? "Trial access is active"
                      : isActive
                        ? "Subscription is active"
                        : "Needs review"
                  }
                />
                <DetailCard
                  label={isTrial ? "Trial ends" : "Billing contact"}
                  value={isTrial ? formattedTrialEnd : billing.billingContact || "—"}
                  helper={isTrial ? "End of trial period" : "Primary billing email"}
                />
              </div>

              {isTrial && (
                <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/8 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/85">
                    Trial status
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {daysRemaining !== null
                      ? daysRemaining > 0
                        ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`
                        : "Trial has ended"
                      : "Trial timing unavailable"}
                  </div>
                  <div className="mt-2 text-sm leading-7 text-slate-300">
                    Your workspace is currently using the {formattedPlan} plan during trial. When the
                    trial ends, billing should continue based on your selected setup.
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleManageBilling}
                  disabled={actionLoading}
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.3)] transition duration-200 hover:scale-[1.01] hover:shadow-[0_18px_40px_rgba(37,99,235,0.38)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {actionLoading
                    ? "Opening..."
                    : billing.stripeCustomerId
                      ? "Manage subscription"
                      : "Choose plan"}
                </button>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Billing history"
          description="This section can show invoices, receipts, renewal dates, and downloadable billing records."
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-slate-300">
            Billing history will look best here as a clean table with invoice date, amount, status,
            and a receipt download action.
          </div>
        </Panel>
      </div>
    </SettingsShell>
  );
}

function DetailCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{helper}</div>
    </div>
  );
}