import express from "express";
import Stripe from "stripe";

export const initStripe = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  const body = req.body;

  const secret_key = process.env.STRIPE_SECRET_KEY;
  // console.log("secret key", typeof req.identity._id.toString());

  const stripe = new Stripe(secret_key as string, {
    apiVersion: "2024-04-10",
    typescript: true,
  });

  console.log("body", body?.price, typeof body?.price);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: parseFloat(body?.price) * 100,
    currency: "usd",
    payment_method_types: ["card", "paypal"],
    // automatic_payment_methods: { enabled: true },
  });

  return res.status(200).json({
    paymentIntent: paymentIntent.client_secret,
    customer: req.identity._id,
  });
};
