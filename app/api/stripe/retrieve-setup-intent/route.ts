import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { setupIntentId } = await req.json();

    if (!setupIntentId) {
      return NextResponse.json(
        { error: "Missing setupIntentId." },
        { status: 400 }
      );
    }

    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    return NextResponse.json({
      id: setupIntent.id,
      status: setupIntent.status,
      customer:
        typeof setupIntent.customer === "string" ? setupIntent.customer : null,
      paymentMethod:
        typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : null,
      metadata: setupIntent.metadata ?? {},
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to retrieve setup intent.",
      },
      { status: 500 }
    );
  }
}
