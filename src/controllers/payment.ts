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

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(price)),
      currency: "usd",
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

// export const payoutToBank = async (
//   req: express.Request,
//   res: express.Response
// ) => {
//   const stripe = getStripe();
//   try {
//     const userId = (req as any).identity._id;
//     let {
//       amount,
//       currency,
//       country,
//       accountHolderName,
//       iban,
//       accountNumber,
//       routingNumber,
//     } = req.body;

//     country = "TN";
//     currency = "tnd";

//     // Validate required parameters
//     if (
//       !amount ||
//       !country ||
//       !accountHolderName ||
//       !iban ||
//       (accountNumber && !routingNumber)
//     ) {
//       console.log("missing fields");
//       return res.status(400).json({ error: "Missing required parameters." });
//     }

//     const user: any = await getUserById(userId);
//     if (!user) {
//       return res.status(404).json({ error: "User not found." });
//     }

//     if (user.credits < amount) {
//       return res.status(400).json({ error: "Insufficient credit." });
//     }

//     let bankAccountId = user.stripeBankAccountId;
//     let connectedAccountId = user.stripeConnectedAccountId;

//     // If no connected account is stored, create one with an external account
//     if (!connectedAccountId) {
//       try {
//         const bankAccountToken = await stripe.tokens.create({
//           bank_account: iban
//             ? {
//                 country: country.anme,
//                 currency: currency,
//                 account_holder_name: accountHolderName,
//                 account_holder_type: "individual",
//                 account_number: iban,
//               }
//             : {
//                 country: country,
//                 currency: currency,
//                 account_holder_name: accountHolderName,
//                 account_holder_type: "individual",
//                 routing_number: routingNumber,
//                 account_number: accountNumber,
//               },
//         });

//         const connectedAccount: any = await stripe.accounts.create({
//           type: "custom",
//           country: country,
//           business_type: "individual",
//           capabilities: {
//             transfers: { requested: true },
//           },
//           business_profile: {
//             url: "https://picsum.photos/200/300",
//           },
//           individual: {
//             first_name: user.firstName,
//             last_name: user.lastName,
//             email: user.email,
//             nationality: "PK",
//             address: {
//               line1: "123 Main St",
//               city: "Anytown",
//               state: "CA",
//               postal_code: "12345",
//               country: country,
//             },
//             dob: {
//               day: 1,
//               month: 1,
//               year: 1990,
//             },
//             id_number: "1234567890",
//           } as any,
//           tos_acceptance: {
//             date: Math.floor(Date.now() / 1000),
//             ip: req.ip,
//             service_agreement: "recipient",
//           },
//           external_account: bankAccountToken.id,
//         });

//         connectedAccountId = connectedAccount.id;
//         bankAccountId = connectedAccount?.external_accounts.data[0].id;

//         await updateUserById(userId, {
//           stripeConnectedAccountId: connectedAccountId,
//           stripeBankAccountId: bankAccountId,
//         });
//       } catch (error: any) {
//         console.log("failed to create connected account", error);
//         return res.status(400).json({
//           error: "Failed to create connected account with external account",
//           details: error.message,
//         });
//       }
//     }

//     // Check if the connected account has unmet requirements
//     const account: any = await stripe.accounts.retrieve(
//       connectedAccountId as any
//     );
//     if (account.requirements.currently_due.length > 0) {
//       console.log("unmet requirements", account.requirements.currently_due);
//       return res.status(400).json({
//         error: "Connected account has unmet requirements.",
//         requirements: account.requirements.currently_due,
//       });
//     }

//     // Check platform balance
//     const platformBalance = await stripe.balance.retrieve();
//     console.log("Platform balance:", platformBalance);

//     // Attempt to transfer funds from the platform account to the connected account
//     try {
//       const transfer = await stripe.transfers.create({
//         amount: amount * 100, // amount in cents
//         currency: "usd",
//         destination: connectedAccountId || "",
//       });

//       console.log("Funds transferred to connected account:", transfer.id);

//       // Implement a delay to allow transfer to process
//       await new Promise((resolve) => setTimeout(resolve, 2000));
//     } catch (error: any) {
//       console.log("Failed to transfer funds to connected account", error);
//       return res.status(400).json({
//         error: "Failed to transfer funds to connected account",
//         details: error.message,
//       });
//     }

//     // Create the payout
//     try {
//       const payout = await stripe.payouts.create(
//         {
//           amount: amount * 100, // amount in cents
//           currency: currency,
//         },
//         {
//           stripeAccount: connectedAccountId || "",
//         }
//       );

//       // Deduct the amount from user's credit
//       const updatedUser = await updateUserById(userId, {
//         $inc: { credits: -amount },
//       });

//       // Create a transaction record
//       await createTransaction({
//         user: userId,
//         amount: amount,
//         paymentIntentId: payout.id,
//         type: "WITHDRAWAL",
//       });

//       return res.status(200).json({
//         success: true,
//         message: "Payout initiated successfully.",
//         payoutId: payout.id,
//         remainingCredit: updatedUser
//           ? updatedUser.credits
//           : user.credits - amount,
//       });
//     } catch (error: any) {
//       console.log("Failed to create payout", error);
//       return res.status(400).json({
//         error: "Failed to create payout",
//         details: error.message,
//       });
//     }
//   } catch (error: any) {
//     console.error("Error initiating payout:", error);
//     if (error.type && error.type.includes("Stripe")) {
//       return res.status(400).json({ error: error.message });
//     }
//     return res.status(500).json({ error: "Internal server error." });
//   }
// };
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
      (!iban && (!accountNumber || !routingNumber))
    ) {
      console.log("All fields required");
      return res
        .status(400)
        .json({ error: "All required fields must be filled." });
    }

    // Validate nationalIdNumber type
    if (typeof nationalIdNumber !== "number") {
      console.log("not a number");
      return res
        .status(400)
        .json({ error: "National ID Number must be a number." });
    }

    const user: any = await UserModel.findById(userId);
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

    // Create Stripe account ID
    const account = await stripe.accounts.create({
      type: "custom",
      country: address.country.cca2, // Use cca2 code
      business_type: "individual",
      capabilities: {
        transfers: { requested: true },
      },
      business_profile: {
        url: user?.avatarUrl || "https://picsum.photos/200/300",
      },
      individual: {
        first_name: firstName || user.firstName,
        last_name: (firstName && lastName) || user.lastName,
        email: user.email,
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
        error: "Connected account has unmet requirements.",
        requirements: account.requirements.currently_due,
      });
    }

    //check platform balance
    const platformBalance = await stripe.balance.retrieve();
    console.log("Platform balance:", platformBalance);

    console.log("checkpoint 1 cleared");

    //transfer funds
    try {
      const transfer = await stripe.transfers.create({
        amount: amount * 100, // amount in cents
        currency: "usd",
        destination: currentBank?.stripeExternalAccountId || "",
      });

      console.log("Funds transferred to connected account:", transfer.id);

      // Implement a delay to allow transfer to process
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.log("Failed to transfer funds to connected account", error);
      return res.status(400).json({
        error: "Failed to transfer funds to connected account",
        details: error.message,
      });
    }

    let currency = "USD";
    //create the stripe payout
    try {
      const payout = await stripe.payouts.create(
        {
          amount: amount * 100, // amount in cents
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
      console.log("Failed to create payout", error);
      return res.status(400).json({
        error: "Failed to create payout",
        details: error.message,
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
