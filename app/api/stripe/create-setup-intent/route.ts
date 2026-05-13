import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { email, firmId, plan, type } = await req.json();

    if (!email || !firmId || !plan || !type) {
      return NextResponse.json(
        { error: "Missing email, firmId, plan, or type." },
        { status: 400 }
      );
    }

    const customers = await stripe.customers.list({
      email,
      limit: 1,
    });

    const customer =
      customers.data[0] ||
      (await stripe.customers.create({
        email,
        metadata: {
          firmId,
          plan,
          type,
        },
      }));

    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      usage: "off_session",
      metadata: {
        firmId,
        plan,
        type,
      },
    });

    if (!setupIntent.client_secret) {
      return NextResponse.json(
        { error: "Stripe did not return a client secret." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
      setupIntentId: setupIntent.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create setup intent.",
      },
      { status: 500 }
    );
  }
}
