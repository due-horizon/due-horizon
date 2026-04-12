import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

type AccountType = "firm" | "business";
type PlanKey =
  | "starter"
  | "growth"
  | "scale"
  | "core"
  | "operations"
  | "enterprise";

function getPriceId(accountType: AccountType, plan: PlanKey) {
  const prices = {
    firm: {
      starter: process.env.STRIPE_PRICE_FIRM_STARTER,
      growth: process.env.STRIPE_PRICE_FIRM_GROWTH,
      scale: process.env.STRIPE_PRICE_FIRM_SCALE,
    },
    business: {
      core: process.env.STRIPE_PRICE_BUSINESS_STARTER,
      operations: process.env.STRIPE_PRICE_BUSINESS_GROWTH,
      enterprise: process.env.STRIPE_PRICE_BUSINESS_SCALE,
    },
  } as const;

  if (accountType === "firm") {
    return prices.firm[plan as keyof typeof prices.firm];
  }

  return prices.business[plan as keyof typeof prices.business];
}

function isValidAccountType(value: string): value is AccountType {
  return value === "firm" || value === "business";
}

function isValidPlan(value: string): value is PlanKey {
  return [
    "starter",
    "growth",
    "scale",
    "core",
    "operations",
    "enterprise",
  ].includes(value);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const firmId = String(body.firmId || "").trim();
    const email = String(body.email || "").trim();
    const accountTypeRaw = String(body.accountType || "").trim().toLowerCase();
    const planRaw = String(body.plan || "").trim().toLowerCase();

    if (!firmId) {
      return NextResponse.json({ error: "Missing firmId." }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "Missing email." }, { status: 400 });
    }

    if (!isValidAccountType(accountTypeRaw)) {
      return NextResponse.json({ error: "Invalid account type." }, { status: 400 });
    }

    if (!isValidPlan(planRaw)) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }

    const accountType = accountTypeRaw as AccountType;
    const plan = planRaw as PlanKey;

    const priceId = getPriceId(accountType, plan);

    if (!priceId) {
      return NextResponse.json(
        { error: "Invalid plan or missing price ID." },
        { status: 400 }
      );
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

    if (!appUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_APP_URL." },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      client_reference_id: firmId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          firmId,
          accountType,
          plan,
        },
      },
      metadata: {
        firmId,
        accountType,
        plan,
      },
      success_url: `${appUrl}/settings/billing?success=true`,
      cancel_url: `${appUrl}/settings/billing?canceled=true`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe checkout failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}