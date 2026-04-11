import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return new NextResponse("Missing Stripe signature", { status: 400 });
  }

  try {
    stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Webhook signature verification failed";
    return new NextResponse(message, { status: 400 });
  }
}