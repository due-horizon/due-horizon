import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // You can omit apiVersion if your installed Stripe package complains.
  // If it accepts it, this keeps behavior pinned.
  apiVersion: "2025-03-31.basil",
});