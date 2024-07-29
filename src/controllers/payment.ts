import { createTransaction } from "../db/transactions";
import { getUserById, updateUserById } from "../db/users";
import express from "express";
import Stripe from "stripe";

// console.log("secret key", typeof req.identity._id.toString());

export const initStripe = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  const body = req.body;
  const secret_key = process.env.STRIPE_SECRET_KEY;
  const stripe = new Stripe(secret_key as string, {
    apiVersion: "2024-04-10",
    typescript: true,
  });

  const user = await getUserById(req.identity._id);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: parseFloat(body?.price) * 100,
    currency: "usd",
    payment_method_types: ["card", "paypal"],
    customer: user?.stripeCustomerId,
    // automatic_payment_methods: { enabled: true },
  });
  return res.status(200).json({
    paymentIntent: paymentIntent.client_secret,
    customer: user.stripeCustomerId,
  });
};

export const createOrRetrieveStripeCustomer = async (user: any) => {
  try {
    const secret_key = process.env.STRIPE_SECRET_KEY;
    const stripe = new Stripe(secret_key as string, {
      apiVersion: "2024-04-10",
      typescript: true,
    });

    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: { userId: user._id.toString() },
    });

    return customer.id;
  } catch (error) {
    console.error("Error creating/retrieving Stripe customer:", error);
    throw error;
  }
};

export const attachPaymentMethodToCustomer = async (
  paymentMethodId: string,
  customerId: string
) => {
  try {
    const secret_key = process.env.STRIPE_SECRET_KEY;
    const stripe = new Stripe(secret_key as string, {
      apiVersion: "2024-04-10",
      typescript: true,
    });

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  } catch (error) {
    console.error("Error attaching payment method to customer:", error);
    throw error;
  }
};
export const addCredits = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const { amount, paymentIntent } = req.body;
    const userId = req.identity._id;

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user's credits
    const updatedUser = await updateUserById(userId, {
      $inc: { credits: amount },
    });

    // Create a transaction record
    await createTransaction({
      user: userId,
      amount: amount,
      paymentIntentId: paymentIntent,
      type: "CREDIT_PURCHASE",
    });

    return res.status(200).json({
      success: true,
      credits: updatedUser.credits,
      message: "Credits added successfully",
    });
  } catch (error) {
    console.error("Error adding credits:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
