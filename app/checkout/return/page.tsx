"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckoutReturnPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Checking payment method...");

  useEffect(() => {
    async function checkStatus() {
      const params = new URLSearchParams(window.location.search);
      const setupIntentId = params.get("setup_intent");
      const clientSecret = params.get("setup_intent_client_secret");
      const plan = params.get("plan") || "growth";
      const type = params.get("type") || "firm";

      if (!setupIntentId || !clientSecret) {
        router.replace(
          `/checkout?plan=${plan}&type=${type}&status=failed&reason=missing_setup_intent_params`
        );
        return;
      }

      const res = await fetch("/api/stripe/retrieve-setup-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          setupIntentId,
        }),
      });

      const text = await res.text();

      let data: {
        error?: string;
        id?: string;
        status?: string;
        customer?: string | null;
        paymentMethod?: string | null;
        metadata?: Record<string, string>;
      } = {};

      try {
        data = JSON.parse(text);
      } catch {
        router.replace(
          `/checkout?plan=${plan}&type=${type}&status=failed&reason=retrieve_setup_intent_non_json`
        );
        return;
      }

      if (!res.ok) {
        const reason = encodeURIComponent(data.error || "retrieve_setup_intent_failed");
        router.replace(
          `/checkout?plan=${plan}&type=${type}&status=failed&reason=${reason}`
        );
        return;
      }

      const cacheKey = `dh-setup-${plan}-${type}`;

      switch (data.status) {
        case "succeeded": {
          if (typeof window !== "undefined") {
            sessionStorage.removeItem(cacheKey);
          }

          const firmId =
            data.metadata?.firmId ||
            (typeof window !== "undefined"
              ? window.localStorage.getItem("dh_checkout_firm_id")
              : null);

          const customerId = data.customer || null;
          const paymentMethodId = data.paymentMethod || null;

          if (!firmId || !customerId || !paymentMethodId) {
            router.replace(
              `/checkout?plan=${plan}&type=${type}&status=failed&reason=missing_checkout_context`
            );
            return;
          }

          setMessage("Payment method saved. Starting your trial...");

          const subscriptionRes = await fetch("/api/stripe/create-subscription", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              firmId,
              customerId,
              paymentMethodId,
              plan,
              type,
            }),
          });

          const subscriptionText = await subscriptionRes.text();

          let subscriptionData: {
            error?: string;
            status?: string;
            subscriptionId?: string;
          } = {};

          try {
            subscriptionData = JSON.parse(subscriptionText);
          } catch {
            router.replace(
              `/checkout?plan=${plan}&type=${type}&status=failed&reason=subscription_non_json`
            );
            return;
          }

          if (!subscriptionRes.ok) {
            const reason = encodeURIComponent(
              subscriptionData.error || "subscription_create_failed"
            );
            router.replace(
              `/checkout?plan=${plan}&type=${type}&status=failed&reason=${reason}`
            );
            return;
          }

          router.replace("/settings/billing?success=true");
          return;
        }

        case "processing":
          router.replace(`/checkout?plan=${plan}&type=${type}&status=processing`);
          return;

        case "requires_payment_method":
          router.replace(
            `/checkout?plan=${plan}&type=${type}&status=failed&reason=requires_payment_method`
          );
          return;

        case "requires_action":
          router.replace(
            `/checkout?plan=${plan}&type=${type}&status=action_required`
          );
          return;

        case "canceled":
          router.replace(`/checkout?plan=${plan}&type=${type}&status=canceled`);
          return;

        default:
          router.replace(
            `/checkout?plan=${plan}&type=${type}&status=failed&reason=unknown_setup_intent_status`
          );
      }
    }

    void checkStatus();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1220] px-6 text-white">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 text-sm text-slate-300">
        {message}
      </div>
    </main>
  );
}
