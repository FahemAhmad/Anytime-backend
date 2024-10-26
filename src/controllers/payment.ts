import { createTransaction } from "../db/transactions";
import { getUserById, updateUserById } from "../db/users";
import express from "express";
import Stripe from "stripe";

const getStripe = () => {
  const secret_key = process.env.STRIPE_SECRET_KEY as string;

  return new Stripe(secret_key, {
    apiVersion: "2024-06-20",
    typescript: true,
  });
};

export const initStripe = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  try {
    const stripe = getStripe();

    const { price } = req.body;
    const user = await getUserById(req.identity._id);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(price)),
      currency: "usd",
      payment_method_types: ["card"],
      customer: user?.stripeCustomerId,
    });

    return res.status(200).json({
      paymentIntent: paymentIntent.client_secret,
      customer: user.stripeCustomerId,
    });
  } catch (error) {
    console.error("Error initializing Stripe payment:", error);
    return res.status(500).json({ error: "Failed to initialize payment" });
  }
};

export const createOrRetrieveStripeCustomer = async (user: any) => {
  try {
    const stripe = getStripe();
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
    const stripe = getStripe();

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

    const updatedUser = await updateUserById(userId, {
      $inc: { credits: amount },
    });

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

export const payoutToBank = async (
  req: express.Request & { identity: any },
  res: express.Response
) => {
  const stripe = getStripe();
  try {
    const userId = req.identity._id;
    let {
      amount,
      currency,
      country,
      accountHolderName,
      iban,
      swiftBic,
      accountNumber,
      routingNumber,
    } = req.body;

    country = "TN";
    currency = "tnd";

    // Validate required parameters
    if (
      !amount ||
      !country ||
      !accountHolderName ||
      !iban ||
      (accountNumber && !routingNumber)
    ) {
      console.log("missing fields");
      return res.status(400).json({ error: "Missing required parameters." });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (user.credits < amount) {
      return res.status(400).json({ error: "Insufficient credit." });
    }

    let bankAccountId = user.stripeBankAccountId;
    let connectedAccountId = user.stripeConnectedAccountId;

    // If no connected account is stored, create one with an external account
    if (!connectedAccountId) {
      try {
        const bankAccountToken = await stripe.tokens.create({
          bank_account: iban
            ? {
                country: country,
                currency: currency,
                account_holder_name: accountHolderName,
                account_holder_type: "individual",
                account_number: iban,
              }
            : {
                country: country,
                currency: currency,
                account_holder_name: accountHolderName,
                account_holder_type: "individual",
                routing_number: routingNumber,
                account_number: accountNumber,
              },
        });

        const connectedAccount = await stripe.accounts.create({
          type: "custom",
          country: country,
          business_type: "individual",
          capabilities: {
            transfers: { requested: true },
          },
          business_profile: {
            url: "https://picsum.photos/200/300",
          },
          individual: {
            first_name: user.firstName,
            last_name: user.lastName,
            email: user.email,
            nationality: "PK",
            address: {
              line1: "123 Main St",
              city: "Anytown",
              state: "CA",
              postal_code: "12345",
              country: country,
            },
            dob: {
              day: 1,
              month: 1,
              year: 1990,
            },
            id_number: "1234567890",
          } as any,
          tos_acceptance: {
            date: Math.floor(Date.now() / 1000),
            ip: req.ip,
            service_agreement: "recipient",
          },
          external_account: bankAccountToken.id,
        });

        connectedAccountId = connectedAccount.id;
        bankAccountId = connectedAccount.external_accounts.data[0].id;

        await updateUserById(userId, {
          stripeConnectedAccountId: connectedAccountId,
          stripeBankAccountId: bankAccountId,
        });
      } catch (error) {
        console.log("failed to create connected account", error);
        return res.status(400).json({
          error: "Failed to create connected account with external account",
          details: error.message,
        });
      }
    }

    // Check if the connected account has unmet requirements
    const account = await stripe.accounts.retrieve(connectedAccountId);
    if (account.requirements.currently_due.length > 0) {
      console.log("unmet requirements", account.requirements.currently_due);
      return res.status(400).json({
        error: "Connected account has unmet requirements.",
        requirements: account.requirements.currently_due,
      });
    }

    // Check platform balance
    const platformBalance = await stripe.balance.retrieve();
    console.log("Platform balance:", platformBalance);

    // Attempt to transfer funds from the platform account to the connected account
    try {
      const transfer = await stripe.transfers.create({
        amount: amount * 100, // amount in cents
        currency: "usd",
        destination: connectedAccountId,
      });

      console.log("Funds transferred to connected account:", transfer.id);

      // Implement a delay to allow transfer to process
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.log("Failed to transfer funds to connected account", error);
      return res.status(400).json({
        error: "Failed to transfer funds to connected account",
        details: error.message,
      });
    }

    // Create the payout
    try {
      const payout = await stripe.payouts.create(
        {
          amount: amount * 100, // amount in cents
          currency: currency,
        },
        {
          stripeAccount: connectedAccountId,
        }
      );

      // Deduct the amount from user's credit
      const updatedUser = await updateUserById(userId, {
        $inc: { credits: -amount },
      });

      // Create a transaction record
      await createTransaction({
        user: userId,
        amount: amount,
        paymentIntentId: payout.id,
        type: "WITHDRAWAL",
      });

      return res.status(200).json({
        success: true,
        message: "Payout initiated successfully.",
        payoutId: payout.id,
        remainingCredit: updatedUser
          ? updatedUser.credits
          : user.credits - amount,
      });
    } catch (error) {
      console.log("Failed to create payout", error);
      return res.status(400).json({
        error: "Failed to create payout",
        details: error.message,
      });
    }
  } catch (error) {
    console.error("Error initiating payout:", error);
    if (error.type && error.type.includes("Stripe")) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error." });
  }
};
