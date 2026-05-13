"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

function getStatusMessage(status: string | null) {
  switch (status) {
    case "canceled":
      return "Checkout was canceled. Choose a payment method and try again.";
    case "failed":
      return "Your payment setup was not completed. Please try again.";
    case "action_required":
      return "Additional payment action is required to complete checkout.";
    case "processing":
      return "Your payment method is processing. You can refresh in a moment.";
    case "setup_complete":
      return "Your payment method was saved. Finalizing your subscription...";
    default:
      return "";
  }
}

function getReasonMessage(reason: string | null) {
  switch (reason) {
    case "missing_setup_intent_params":
      return "Stripe did not return the setup intent details needed to finish checkout.";
    case "retrieve_setup_intent_non_json":
      return "The setup intent verification route returned an invalid response.";
    case "missing_checkout_context":
      return "Checkout completed, but the workspace context was missing when creating the subscription.";
    case "requires_payment_method":
      return "That payment method could not be saved. Please try another option.";
    case "subscription_non_json":
      return "The subscription route returned an invalid response.";
    default:
      return "";
  }
}

export default function CheckoutPage() {
  const [clientSecret, setClientSecret] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [elementLoadError, setElementLoadError] = useState("");

  const checkoutContext = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        plan: "growth",
        type: "firm",
        status: null as string | null,
        reason: null as string | null,
        cacheKey: "dh-setup-growth-firm",
      };
    }

    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan") || "growth";
    const type = params.get("type") || "firm";
    const status = params.get("status");
    const reason = params.get("reason");

    return {
      plan,
      type,
      status,
      reason,
      cacheKey: `dh-setup-${plan}-${type}`,
    };
  }, []);

  async function loadSetupIntent() {
    try {
      setLoading(true);
      setLoadError("");
      setElementLoadError("");
      setClientSecret("");

      const storedEmail =
        typeof window !== "undefined"
          ? window.localStorage.getItem("dh_checkout_email") || ""
          : "";
      const storedFirmId =
        typeof window !== "undefined"
          ? window.localStorage.getItem("dh_checkout_firm_id") || ""
          : "";

      if (!storedEmail || !storedFirmId) {
        throw new Error(
          "Missing checkout context. Please start again from onboarding or billing."
        );
      }

      if (typeof window !== "undefined") {
        sessionStorage.removeItem(checkoutContext.cacheKey);
      }

      const res = await fetch("/api/stripe/create-setup-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: storedEmail,
          firmId: storedFirmId,
          plan: checkoutContext.plan,
          type: checkoutContext.type,
        }),
        cache: "no-store",
      });

      const text = await res.text();

      let data: {
        clientSecret?: string;
        error?: string;
      };

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Route did not return JSON. Response started with: ${text.slice(0, 80)}`
        );
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create setup intent.");
      }

      if (!data?.clientSecret) {
        throw new Error("No clientSecret returned from setup intent route.");
      }

      setClientSecret(data.clientSecret);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load checkout."
      );
      setClientSecret("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSetupIntent();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0b1220] px-6 py-10 text-white">
        <div className="mx-auto max-w-xl">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
            <div className="h-8 w-56 animate-pulse rounded-xl bg-white/10" />
            <div className="mt-3 h-4 w-72 animate-pulse rounded-lg bg-white/5" />
            <div className="mt-8 space-y-4">
              <div className="h-12 animate-pulse rounded-2xl bg-white/5" />
              <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
              <div className="h-12 animate-pulse rounded-2xl bg-white/10" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-[#0b1220] px-6 py-10 text-white">
        <div className="mx-auto max-w-xl">
          <div className="rounded-[28px] border border-red-400/20 bg-red-500/10 p-6">
            <div className="text-lg font-semibold text-red-200">
              Checkout couldn’t load
            </div>
            <div className="mt-2 text-sm text-red-300">{loadError}</div>

            <button
              type="button"
              onClick={() => void loadSetupIntent()}
              className="mt-5 h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-sm font-semibold text-white"
            >
              Retry checkout
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b1220] px-6 py-10 text-white">
      <div className="mx-auto max-w-xl">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
          <h1 className="text-3xl font-semibold">Start your 14-day free trial</h1>
          <p className="mt-2 text-slate-400">
            You won’t be charged today. Your subscription will begin after your
            trial ends.
          </p>

          <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
            Full access during your 14-day trial. Cancel anytime before it ends.
          </div>

          {!!getStatusMessage(checkoutContext.status) && (
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {getStatusMessage(checkoutContext.status)}
            </div>
          )}

          {!!getReasonMessage(checkoutContext.reason) && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
              {getReasonMessage(checkoutContext.reason)}
            </div>
          )}

          {elementLoadError && (
            <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {elementLoadError}
            </div>
          )}

          <div className="mt-6">
            {clientSecret ? (
              <Elements
                key={clientSecret}
                stripe={stripePromise}
                options={{
                  clientSecret,
                  currency: "usd",
                  appearance: {
                    theme: "night",
                    variables: {
                      colorPrimary: "#22d3ee",
                      colorBackground: "#020617",
                      colorText: "#ffffff",
                    },
                  },
                }}
              >
                <CheckoutForm
                  plan={checkoutContext.plan}
                  type={checkoutContext.type}
                  onElementLoadError={setElementLoadError}
                />
              </Elements>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
                Loading payment form...
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function CheckoutForm({
  plan,
  type,
  onElementLoadError,
}: {
  plan: string;
  type: string;
  onElementLoadError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!stripe || !elements) {
      setError("Checkout is still loading. Please try again in a moment.");
      return;
    }

    setSubmitting(true);
    setError("");
    onElementLoadError("");

    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/return?plan=${encodeURIComponent(
          plan
        )}&type=${encodeURIComponent(type)}`,
      },
    });

    if (error) {
      setError(error.message || "Payment setup failed.");
      setSubmitting(false);
      return;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-[#020617] px-4 py-4">
        <PaymentElement
          onReady={() => {
            onElementLoadError("");
          }}
          onLoadError={() => {
            onElementLoadError(
              "We couldn’t load the full payment form. Stripe is rejecting one or more enabled payment methods for this setup flow."
            );
          }}
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={submitting || !stripe || !elements}
          className="h-12 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white disabled:opacity-70"
        >
          {submitting ? "Saving payment method..." : "Start free trial"}
        </button>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
        >
          Reload checkout
        </button>
      </div>
    </form>
  );
}
