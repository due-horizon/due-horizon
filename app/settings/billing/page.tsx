"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Panel, SettingsShell } from "../_shared";
import { Check, Sparkles } from "lucide-react";

type BillingState = {
  firmId: string | null;
  plan: string;
  subscriptionStatus: string;
  billingContact: string;
  stripeCustomerId: string | null;
  trialEndsAt: string | null;
  workspaceName: string;
  workspaceType: string;
};

type PlanCard = {
  key: string;
  name: string;
  priceLabel: string;
  description: string;
  features: string[];
  recommended?: boolean;
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

function normalizeWorkspaceType(value: string | null | undefined): "firm" | "business" | "workspace" {
  const normalized = (value || "").toLowerCase();

  if (normalized === "business" || normalized === "business_owner") {
    return "business";
  }

  if (normalized === "firm" || normalized === "accounting_firm") {
    return "firm";
  }

  return "workspace";
}

function getWorkspaceTypeLabel(value: string | null | undefined) {
  const normalized = normalizeWorkspaceType(value);

  if (normalized === "business") return "Business workspace";
  if (normalized === "firm") return "Accounting firm workspace";
  return "Workspace";
}

function isPaidOrTrialStatus(value: string | null | undefined) {
  const normalized = (value || "").toLowerCase();
  return normalized === "trial" || normalized === "trialing" || normalized === "active" || normalized === "past_due";
}

function getRecommendedPlan(workspaceType: "firm" | "business" | "workspace") {
  return workspaceType === "business" ? "operations" : "growth";
}

function getPlanCards(workspaceType: "firm" | "business" | "workspace"): PlanCard[] {
  if (workspaceType === "business") {
    return [
      {
        key: "core",
        name: "Core",
        priceLabel: "Entry plan",
        description: "For smaller businesses that need the essentials.",
        features: ["Core filing visibility", "Team access", "Calendar basics"],
      },
      {
        key: "operations",
        name: "Operations",
        priceLabel: "Best fit",
        description: "For growing businesses that need deeper operational control.",
        features: ["Advanced reports", "Bulk workflows", "Multi-entity support"],
        recommended: true,
      },
      {
        key: "enterprise",
        name: "Enterprise",
        priceLabel: "Highest tier",
        description: "For complex organizations that need top-end control and support.",
        features: ["Client portal", "Priority support", "Custom roles"],
      },
    ];
  }

  return [
    {
      key: "starter",
      name: "Starter",
      priceLabel: "Entry plan",
      description: "For smaller firms getting off spreadsheets.",
      features: ["Core reporting", "Team access", "Calendar basics"],
    },
    {
      key: "growth",
      name: "Growth",
      priceLabel: "Best fit",
      description: "For firms managing more entities and tighter deadlines.",
      features: ["Advanced reports", "Bulk workflows", "Client portal"],
      recommended: true,
    },
    {
      key: "scale",
      name: "Scale",
      priceLabel: "Highest tier",
      description: "For firms that need the strongest controls and support.",
      features: ["Priority support", "Custom roles", "Advanced operations"],
    },
  ];
}

export default function BillingSettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPlanLoading, setSelectedPlanLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [canceled, setCanceled] = useState(false);

  const [billing, setBilling] = useState<BillingState>({
    firmId: null,
    plan: "",
    subscriptionStatus: "",
    billingContact: "",
    stripeCustomerId: null,
    trialEndsAt: null,
    workspaceName: "",
    workspaceType: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    setSuccess(params.get("success") === "true");
    setCanceled(params.get("canceled") === "true");
  }, []);

  useEffect(() => {
    async function loadBilling() {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error("Unable to load billing details.");
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
          throw new Error("Unable to load billing details.");
        }

        const membershipIds = (memberships || []).map((membership) => membership.firm_id);
        const resolvedFirmId =
          (preferredFirmId && membershipIds.includes(preferredFirmId) ? preferredFirmId : null) ||
          membershipIds[0] ||
          preferredFirmId ||
          null;

        if (!resolvedFirmId) {
          throw new Error("No workspace was found for this account.");
        }

        const { data: firm, error: firmError } = await supabase
          .from("firms")
          .select("id, name, type, plan, subscription_status, stripe_customer_id, trial_ends_at")
          .eq("id", resolvedFirmId)
          .maybeSingle();

        if (firmError || !firm) {
          throw new Error("Unable to load workspace billing details.");
        }

        setBilling({
          firmId: resolvedFirmId,
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load billing details.");
      } finally {
        setLoading(false);
      }
    }

    void loadBilling();
  }, [supabase]);

  const normalizedWorkspaceType = normalizeWorkspaceType(billing.workspaceType);
  const formattedPlan = formatPlan(billing.plan);
  const formattedStatus = formatStatus(billing.subscriptionStatus);
  const formattedTrialEnd = formatDate(billing.trialEndsAt);
  const daysRemaining = getDaysRemaining(billing.trialEndsAt);
  const recommendedPlan = getRecommendedPlan(normalizedWorkspaceType);
  const planCards = getPlanCards(normalizedWorkspaceType);

  const isTrial =
    billing.subscriptionStatus === "trial" || billing.subscriptionStatus === "trialing";
  const isActive = billing.subscriptionStatus === "active";
  const canOpenPortal = Boolean(billing.stripeCustomerId) && isPaidOrTrialStatus(billing.subscriptionStatus);

  async function stashCheckoutContext() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Unable to open billing.");
    }

    const resolvedFirmId =
      billing.firmId ||
      (typeof user.user_metadata?.firm_id === "string"
        ? user.user_metadata.firm_id
        : typeof user.user_metadata?.workspace_id === "string"
          ? user.user_metadata.workspace_id
          : null);

    if (typeof window !== "undefined") {
      if (user.email) {
        window.localStorage.setItem("dh_checkout_email", user.email);
      }

      if (resolvedFirmId) {
        window.localStorage.setItem("dh_checkout_firm_id", resolvedFirmId);
      }
    }
  }

  async function handleManageBilling() {
    try {
      setActionLoading(true);
      setError(null);

      await stashCheckoutContext();

      if (canOpenPortal && billing.stripeCustomerId) {
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

      const checkoutPlan = billing.plan || recommendedPlan;
      const checkoutType = normalizedWorkspaceType === "workspace" ? "firm" : normalizedWorkspaceType;

      window.location.href = `/checkout?plan=${checkoutPlan}&type=${checkoutType}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open billing.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleChoosePlan(planKey: string) {
    try {
      setSelectedPlanLoading(planKey);
      setError(null);

      await stashCheckoutContext();

      const checkoutType = normalizedWorkspaceType === "workspace" ? "firm" : normalizedWorkspaceType;
      window.location.href = `/checkout?plan=${planKey}&type=${checkoutType}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open checkout.");
      setSelectedPlanLoading(null);
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
                  helper={getWorkspaceTypeLabel(billing.workspaceType)}
                />
                <DetailCard
                  label="Current plan"
                  value={formattedPlan}
                  helper={
                    billing.plan
                      ? "Selected from pricing"
                      : `Recommended default: ${formatPlan(recommendedPlan)}`
                  }
                />
                <DetailCard
                  label="Status"
                  value={formattedStatus}
                  helper={
                    isTrial
                      ? "Trial access is active"
                      : isActive
                        ? "Subscription is active"
                        : canOpenPortal
                          ? "Billing record exists"
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
                    Your workspace is currently using the {formattedPlan} plan during trial.
                  </div>
                </div>
              )}

              {!isTrial && !isActive && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Recommended next step
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {billing.plan ? `Continue with ${formattedPlan}` : `Start with ${formatPlan(recommendedPlan)}`}
                  </div>
                  <div className="mt-2 text-sm leading-7 text-slate-300">
                    {normalizedWorkspaceType === "business"
                      ? "Business workspaces default best to Operations unless you selected another plan."
                      : "Firm workspaces default best to Growth unless you selected another plan."}
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
                    : canOpenPortal
                      ? "Manage subscription"
                      : "Go to checkout"}
                </button>

                {!canOpenPortal && (
                  <div className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                    {billing.stripeCustomerId
                      ? "Customer record exists, but no active portal-ready subscription was found."
                      : "No Stripe customer record yet. Checkout will create it automatically."}
                  </div>
                )}
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Upgrade or change plan"
          description="Choose the plan that best fits your workspace and upgrade directly from billing."
        >
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
              Loading available plans...
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/8 px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-2.5 text-cyan-200">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {normalizedWorkspaceType === "business"
                        ? "Business plans available"
                        : "Firm plans available"}
                    </div>
                    <div className="mt-1 text-sm leading-7 text-slate-300">
                      Your current plan is {formattedPlan}. Choose another option below to start checkout for that plan.
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {planCards.map((planCard) => {
                  const isCurrentPlan = billing.plan.toLowerCase() === planCard.key.toLowerCase();
                  const isRecommended = planCard.recommended;
                  const buttonLoading = selectedPlanLoading === planCard.key;

                  return (
                    <PlanOptionCard
                      key={planCard.key}
                      name={planCard.name}
                      priceLabel={planCard.priceLabel}
                      description={planCard.description}
                      features={planCard.features}
                      recommended={Boolean(isRecommended)}
                      current={isCurrentPlan}
                      loading={buttonLoading}
                      onSelect={() => void handleChoosePlan(planCard.key)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Billing history"
          description="This section can show invoices, receipts, renewal dates, and downloadable billing records."
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-slate-300">
            Billing history will appear here once Stripe invoices are wired in.
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

function PlanOptionCard({
  name,
  priceLabel,
  description,
  features,
  recommended,
  current,
  loading,
  onSelect,
}: {
  name: string;
  priceLabel: string;
  description: string;
  features: string[];
  recommended: boolean;
  current: boolean;
  loading: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)] ${
        current
          ? "border-cyan-300/20 bg-[linear-gradient(180deg,rgba(8,47,73,0.18),rgba(15,23,42,0.05))]"
          : recommended
            ? "border-blue-400/20 bg-[linear-gradient(180deg,rgba(30,58,138,0.16),rgba(15,23,42,0.05))]"
            : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white">{name}</div>
          <div className="mt-1 text-sm text-cyan-200">{priceLabel}</div>
        </div>

        {current ? (
          <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
            Current
          </span>
        ) : recommended ? (
          <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-100">
            Recommended
          </span>
        ) : null}
      </div>

      <div className="mt-3 text-sm leading-7 text-slate-300">{description}</div>

      <div className="mt-4 space-y-2">
        {features.map((feature) => (
          <div key={feature} className="flex items-start gap-2 text-sm text-slate-300">
            <Check size={15} className="mt-0.5 text-cyan-200" />
            <span>{feature}</span>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={onSelect}
          disabled={current || loading}
          className={`inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${
            current
              ? "cursor-not-allowed border border-white/10 bg-white/[0.04] text-slate-400"
              : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_12px_30px_rgba(37,99,235,0.3)] hover:scale-[1.01]"
          } disabled:opacity-70`}
        >
          {current ? "Current plan" : loading ? "Opening checkout..." : `Choose ${name}`}
        </button>
      </div>
    </div>
  );
}
