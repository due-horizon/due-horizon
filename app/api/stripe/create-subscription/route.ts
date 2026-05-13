import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Map Stripe subscription statuses → your app's allowed DB values
 */
function mapStripeSubscriptionStatus(status: string) {
  switch (status) {
    case "trialing":
      return "trial";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "past_due";
    case "incomplete":
    case "incomplete_expired":
      return "expired";
    case "paused":
      return "expired";
    default:
      return "expired";
  }
}

function getPriceId(plan: string, type: string) {
  if (type === "firm") {
    switch (plan) {
      case "starter":
        return process.env.STRIPE_PRICE_FIRM_STARTER!;
      case "growth":
        return process.env.STRIPE_PRICE_FIRM_GROWTH!;
      case "scale":
        return process.env.STRIPE_PRICE_FIRM_SCALE!;
      default:
        throw new Error(`Invalid firm plan: ${plan}`);
    }
  }

  if (type === "business") {
    switch (plan) {
      case "core":
        return process.env.STRIPE_PRICE_BUSINESS_CORE!;
      case "operations":
        return process.env.STRIPE_PRICE_BUSINESS_OPERATIONS!;
      case "enterprise":
        return process.env.STRIPE_PRICE_BUSINESS_ENTERPRISE!;
      default:
        throw new Error(`Invalid business plan: ${plan}`);
    }
  }

  throw new Error(`Invalid account type: ${type}`);
}

export async function POST(req: Request) {
  try {
    const { customerId, paymentMethodId, plan, firmId, type } =
      await req.json();

    if (!customerId || !paymentMethodId || !plan || !firmId || !type) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const priceId = getPriceId(plan, type);

    console.log("Creating subscription:", {
      customerId,
      paymentMethodId,
      plan,
      type,
      firmId,
      priceId,
    });

    // Attach payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
      metadata: {
        firmId,
        plan,
        type,
      },
    });

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 14,
      default_payment_method: paymentMethodId,
      metadata: {
        firmId,
        plan,
        type,
      },
    });

    // Convert Stripe timestamp → ISO
    const trialEndsAt =
      typeof subscription.trial_end === "number"
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null;

    // 🔥 FIX: map Stripe status → DB-safe value
    const appStatus = mapStripeSubscriptionStatus(subscription.status);

    const updatePayload = {
      stripe_customer_id: customerId,
      subscription_status: appStatus,
      plan,
      trial_ends_at: trialEndsAt,
    };

    console.log("Updating firm billing:", {
      firmId,
      updatePayload,
      stripeStatus: subscription.status,
      mappedStatus: appStatus,
    });

    const { data, error } = await supabase
      .from("firms")
      .update(updatePayload)
      .eq("id", firmId)
      .select("id, subscription_status, stripe_customer_id, plan")
      .maybeSingle();

    if (error) {
      console.error("Supabase update error:", error);

      return NextResponse.json(
        {
          error: `Subscription created but DB update failed: ${error.message}`,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Subscription created but no matching firm found to update.",
        },
        { status: 500 }
      );
    }

    console.log("Billing sync success:", data);

    return NextResponse.json({
      subscriptionId: subscription.id,
      status: subscription.status,
      mappedStatus: appStatus,
      trialEndsAt,
    });
  } catch (error) {
    console.error("Subscription error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create subscription.",
      },
      { status: 500 }
    );
  }
}