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

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const firmId = String(body.firmId || "");
    const email = String(body.email || "");
    const accountType = String(body.accountType || "") as AccountType;
    const plan = String(body.plan || "").toLowerCase() as PlanKey;

    if (!firmId) {
      return NextResponse.json({ error: "Missing firmId." }, { status: 400 });
    }

    const priceId = getPriceId(accountType, plan);

    if (!priceId) {
      return NextResponse.json(
        { error: "Invalid plan or missing price ID." },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      client_reference_id: firmId,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}