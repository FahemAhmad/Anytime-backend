import { BankModel, getBankById } from "../db/bank";
import { createTransaction } from "../db/transactions";
import { getUserById, updateUserById, UserModel } from "../db/users";
import express from "express";
import Stripe from "stripe";

const getClientIp = (req: express.Request): string => {
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string") {
    return xForwardedFor.split(",")[0].trim();
  } else if (Array.isArray(xForwardedFor)) {
    return xForwardedFor[0];
  }
  return req.socket.remoteAddress || "";
};

const getUserAgent = (req: express.Request): string => {
  return req.headers["user-agent"] || "Unknown";
};

function splitDate(dateString: string): {
  year: string;
  month: string;
  day: string;
} {
  const [year, month, day] = dateString.split("-");
  return { year, month, day };
}

const getStripe = () => {
  const secret_key = process.env.STRIPE_SECRET_KEY as string;

  return new Stripe(secret_key, {
    apiVersion: "2024-06-20",
    typescript: true,
  });
};

export const initStripe = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const stripe = getStripe();

    const { price } = req.body;

    const user: any = await getUserById((req as any).identity._id);

    if (!user?.stripeCustomerId) {
      user.stripeCustomerId = await createOrRetrieveStripeCustomer(
        (req as any).identity._id
      );

      await user.save();
    }

    let finalPrice = Number(price) * 100;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(finalPrice.toString())),
      currency: "gbp",
      payment_method_types: ["card"],
      customer: user?.stripeCustomerId || "",
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
  req: express.Request,
  res: express.Response
) => {
  try {
    const { amount, paymentIntent } = req.body;
    const userId = (req as any).identity._id;
    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updatedUser: any = await updateUserById(userId, {
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

export const addBank = async (req: express.Request, res: express.Response) => {
  try {
    const stripe = getStripe();
    const userId = (req as any).identity._id;

    const {
      nationalIdNumber,
      accountHolderName,
      dateOfBirth,
      currency,
      address,
      bankCountry,
      bankName,
      accountNumber,
      routingNumber,
      iban,
      phoneNumber,
      mcc,
    } = req.body;

    // Validate required fields
    if (
      !nationalIdNumber ||
      !accountHolderName ||
      !dateOfBirth ||
      !currency ||
      !address ||
      !address.country ||
      !address.postalCode ||
      !address.state ||
      !address.city ||
      !address.line1 ||
      !bankCountry ||
      !bankName ||
      !phoneNumber ||
      (!iban && (!accountNumber || !routingNumber))
    ) {
      console.log("All fields required");
      return res
        .status(400)
        .json({ error: "All required fields must be filled." });
    }

    // Validate nationalIdNumber type
    if (typeof nationalIdNumber !== "number") {
      return res
        .status(400)
        .json({ error: "National ID Number must be a number." });
    }

    const user: any = await UserModel.findById(userId).select(
      "+linkedBankAccounts"
    );
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    const { year, month, day } = splitDate(dateOfBirth);

    // Check for duplicate bank account
    const duplicateAccount = await BankModel.findOne({
      userId,
      $or: [{ accountNumber: accountNumber }, { iban: iban }],
    });

    if (duplicateAccount) {
      return res
        .status(400)
        .json({ error: "This bank account is already linked." });
    }

    // Create Stripe bank account token
    const bankAccountDetails: any = iban
      ? {
          country: bankCountry.cca2,
          currency: currency,
          account_holder_name: accountHolderName,
          account_holder_type: "individual",
          account_number: iban,
          routing_number: routingNumber,
        }
      : {
          country: bankCountry.cca2,
          currency: currency,
          account_holder_type: "individual",
          account_holder_name: accountHolderName,
          routing_number: routingNumber,
          account_number: accountNumber,
        };

    const bankAccountToken = await stripe.tokens.create({
      bank_account: bankAccountDetails,
    });

    const [firstName, lastName] = accountHolderName.split(" ") || "";

    let isUS = address.country.cca2;
    // Create Stripe account ID
    const account = await stripe.accounts.create({
      type: "custom",
      country: address.country.cca2, // Use cca2 code
      business_type: "individual",
      capabilities: isUS
        ? {
            card_payments: { requested: true },
            transfers: { requested: true },
          }
        : {
            transfers: { requested: true },
          },
      business_profile: {
        url: user?.avatarUrl || "https://picsum.photos/200/300",
        ...(mcc && { mcc }),
      },
      individual: {
        first_name: firstName || user.firstName,
        last_name: (firstName && lastName) || user.lastName,
        email: user.email,
        phone: phoneNumber,
        nationality: address.country.cca2, // Use cca2 code
        address: {
          line1: address.line1,
          city: address.city,
          state: address.state,
          postal_code: address.postalCode, // Ensure this matches your schema
          country: address.country.cca2, // Use cca2 code
        },
        id_number: nationalIdNumber,
        dob: {
          day,
          month,
          year,
        },
      } as any,
      tos_acceptance: {
        date: Math.floor(Date.now() / 1000), // Current timestamp in seconds
        ip: getClientIp(req), // Client's IP address
        user_agent: getUserAgent(req),
        service_agreement: "full",
      },
      external_account: bankAccountToken.id,
    });

    // Create new BankModel instance with correct field types
    const newBankDetails = new BankModel({
      userId,
      nationalIdNumber: Number(nationalIdNumber),
      accountHolderName,
      dateOfBirth,
      currency,
      address: {
        ...address,
        country: address.country.cca2, // Assign as string
      },
      bankCountry: bankCountry.cca2, // Assign as string
      bankName,
      accountNumber: accountNumber || undefined,
      routingNumber: routingNumber || undefined,
      iban: iban || undefined,
      stripeExternalAccountId: account.id, // Assign only the ID as string
      stripeBankAccountId: (account as any)?.external_accounts.data[0].id,
    });

    await newBankDetails.save();

    // Fix for pushing to the array
    if (!user.linkedBankAccounts) {
      user.linkedBankAccounts = [];
    }
    user.linkedBankAccounts.push(newBankDetails._id);

    await user.save();

    res.status(200).json(newBankDetails);
  } catch (error: any) {
    console.log("err", error.response || error.message);
    res.status(400).json({ error: error.message });
  }
};

export const payoutToBank = async (
  req: express.Request,
  res: express.Response
) => {
  const stripe = getStripe();

  try {
    const userId = (req as any).identity._id;
    let { amount, bankId } = req.body;

    const user: any = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (!bankId || !amount)
      return res.status(400).json({ error: "Missing required parameters." });

    const currentBank = await getBankById(bankId);

    if (currentBank?.userId.toString() !== userId.toString()) {
      return res.status(400).json({ error: "Invalid bank details" });
    }

    if (user.credits < amount) {
      return res.status(400).json({ error: "Low account balance" });
    }
    // Check if the connected account has unmet requirements
    const account: any = await stripe.accounts.retrieve(
      currentBank?.stripeExternalAccountId as any
    );
    if (account.requirements.currently_due.length > 0) {
      console.log("unmet requirements", account.requirements.currently_due);
      return res.status(400).json({
        error: `Connected account has unmet requirements. ${account.requirements.currently_due}`,
        requirements: account.requirements.currently_due,
      });
    }

    //check platform balance
    const platformBalance = await stripe.balance.retrieve();
    console.log("Platform balance:", platformBalance);

    //transfer funds
    try {
      await stripe.transfers.create({
        amount: amount * 97.5, // amount in cents
        currency: "gbp",
        destination: currentBank?.stripeExternalAccountId || "",
      });

      // Implement a delay to allow transfer to process
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.log("Failed to transfer funds to connected account", error);
      return res.status(400).json({
        error: "Failed to transfer funds to connected account",
        details: error.message,
      });
    }

    console.log("reaced here");
    let currency = "gbp";
    //create the stripe payout
    try {
      const payout = await stripe.payouts.create(
        {
          amount: amount * 97.5, // amount in cents
          currency: currency,
        },
        {
          stripeAccount: currentBank?.stripeExternalAccountId || "",
        }
      );

      // Deduct the amount from user's credit
      const updatedUser = await updateUserById(userId, {
        $inc: { credits: -amount },
      });

      console.log("reaced here 2");
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
    } catch (error: any) {
      console.log("error", error);
      return res.status(400).json({
        error: error,
      });
    }

    //create a transaction
  } catch (error: any) {
    if (error.type && error.type.includes("Stripe")) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error." });
  }
};

/**
 *  - API endpoint to remove a linked bank account for a user.
 *
 * @param req - Express request object
 * @param res - Express response object
 */
export const removeBank = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const stripe = getStripe();
    const userId = (req as any).identity._id;

    const { bankId } = req.params;

    // Validate that bankId is provided
    if (!bankId) {
      return res.status(400).json({ error: "Bank ID is required." });
    }

    // Fetch the user with linked bank accounts
    const user: any = await UserModel.findById(userId).populate({
      path: "linkedBankAccounts",
      select: "+stripeExternalAccountId +stripeBankAccountId",
    });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Find the bank account to remove
    const bankAccount = user.linkedBankAccounts.find(
      (bank: any) => bank._id.toString() === bankId
    );
    if (!bankAccount) {
      return res.status(404).json({ error: "Bank account not found." });
    }

    // Remove the bank account from Stripe
    if (bankAccount.stripeExternalAccountId) {
      try {
        await stripe.accounts.deleteExternalAccount(
          bankAccount.stripeBankAccountId,
          bankAccount.stripeExternalAccountId
        );
      } catch (stripeError: any) {
        console.error("Stripe Error:", stripeError);
        return res
          .status(500)
          .json({ error: "Failed to remove bank account from Stripe." });
      }
    } else {
      console.warn("No Stripe External Account ID found for the bank account.");
    }

    // Remove the bank account from the BankModel
    await BankModel.findByIdAndDelete(bankId);

    // Remove the bank account reference from the user
    user.linkedBankAccounts = user.linkedBankAccounts.filter(
      (bank: any) => bank._id.toString() !== bankId
    );

    await user.save();

    res.status(200).json({ message: "Bank account removed successfully." });
  } catch (error: any) {
    console.error("Error removing bank account:", error);
    res
      .status(500)
      .json({ error: "An error occurred while removing the bank account." });
  }
};
